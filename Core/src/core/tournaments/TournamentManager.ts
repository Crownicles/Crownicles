import {
	literal, Op
} from "sequelize";
import {
	createHash, randomBytes
} from "node:crypto";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandTournamentErrorPacketRes,
	TournamentErrorCode, TournamentErrorCodes
} from "../../../../Lib/src/packets/commands/CommandTournamentPacket";
import { TournamentConstants } from "../../../../Lib/src/constants/TournamentConstants";
import {
	TournamentCategories, TournamentCategory, TournamentNotificationEvents,
	TournamentStatuses, TournamentTopCategory
} from "../../../../Lib/src/types/Tournament";
import {
	asDays, asHours, asMinutes, daysToMilliseconds, hoursToMilliseconds, minutesToMilliseconds
} from "../../../../Lib/src/utils/TimeUtils";
import { FightConstants } from "../../../../Lib/src/constants/FightConstants";
import { Tournament } from "../database/game/models/Tournament";
import { TournamentCode } from "../database/game/models/TournamentCode";
import { TournamentFight } from "../database/game/models/TournamentFight";
import { TournamentParticipant } from "../database/game/models/TournamentParticipant";
import Player from "../database/game/models/Player";
import { LeagueDataController } from "../../data/League";
import {
	generateRandomLootEnchantment, generateRandomLootLevel
} from "../utils/ItemUtils";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { crowniclesInstance } from "../../app";
import { PacketUtils } from "../utils/PacketUtils";
import { TournamentNotificationPacket } from "../../../../Lib/src/packets/notifications/TournamentNotificationPacket";
import { TournamentFightRewardPacket } from "../../../../Lib/src/packets/fights/TournamentFightRewardPacket";
import { Badge } from "../../../../Lib/src/types/Badge";
import { EloUtils } from "../utils/EloUtils";
import {
	Locked, LockedRowNotFoundError, withLockedEntities
} from "../../../../Lib/src/locks/withLockedEntities";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";
import { PlayerBadgesManager } from "../database/game/models/PlayerBadges";
import { AsyncLock } from "../../../../Lib/src/locks/AsyncLock";
import type { FightController } from "../fights/FightController";
import type { EloGameResult } from "../../../../Lib/src/types/EloGameResult";

export type TournamentCommandAccess = "none" | "registration" | "participant" | "fight";

export type TournamentFightContext = {
	tournamentId: number;
	attackerParticipantId: number;
	defenderParticipantId: number;
	category: TournamentCategory;
};

export class TournamentDomainError extends Error {
	public readonly code: TournamentErrorCode;

	public constructor(code: TournamentErrorCode) {
		super(code);
		this.name = "TournamentDomainError";
		this.code = code;
	}
}

type TournamentStatusData = {
	tournamentId: number;
	status: typeof TournamentStatuses[keyof typeof TournamentStatuses];
	registrationEndsAt: number;
	combatEndsAt: number;
	participantCount: number;
	categoryCounts: Record<TournamentCategory, number>;
	category?: TournamentCategory;
	attackGloryPoints?: number;
	defenseGloryPoints?: number;
};

type TournamentTopData = {
	tournamentId: number;
	categories: TournamentTopCategory[];
	pageNumber: number;
	totalPages: number;
	elementsPerPage: number;
};

type TournamentEventData = {
	event: typeof TournamentNotificationEvents[keyof typeof TournamentNotificationEvents];
	cancellationReason?: string;
};

const ACTIVE_STATUSES = [
	TournamentStatuses.REGISTRATION,
	TournamentStatuses.COMBAT,
	TournamentStatuses.PAUSED
];

const CONTEXT_STATUSES = [
	...ACTIVE_STATUSES,
	TournamentStatuses.COMPLETED,
	TournamentStatuses.CANCELLED
];

const PROCESSABLE_STATUSES = [
	TournamentStatuses.REGISTRATION,
	TournamentStatuses.COMBAT,
	TournamentStatuses.COMPLETED
];

const tournamentDefenderCooldowns = new Map<string, number>();
const tournamentMatchmakingLocks = new Map<number, AsyncLock>();

function getCategoryForLevel(level: number): TournamentCategory {
	return level >= 100 ? TournamentCategories.LEVEL_100 : TournamentCategories.LEVEL_50;
}

function getEffectiveLevel(category: TournamentCategory, level: number): number {
	return Math.min(level, category === TournamentCategories.LEVEL_50 ? 50 : 100);
}

function getCategoryCounts(participants: TournamentParticipant[]): Record<TournamentCategory, number> {
	return {
		[TournamentCategories.LEVEL_50]: participants.filter(participant => participant.category === TournamentCategories.LEVEL_50).length,
		[TournamentCategories.LEVEL_100]: participants.filter(participant => participant.category === TournamentCategories.LEVEL_100).length
	};
}

function getRewardMultiplier(participantCount: number, category: TournamentCategory): number {
	const baseMultiplier = TournamentConstants.MINIMUM_REWARD_MULTIPLIER
		+ Math.floor((participantCount - TournamentConstants.MINIMUM_TOTAL_PARTICIPANTS) / TournamentConstants.REWARD_MULTIPLIER_PARTICIPANT_STEP);
	return category === TournamentCategories.LEVEL_50
		? baseMultiplier / TournamentConstants.LEVEL_50_REWARD_DIVISOR
		: baseMultiplier;
}

function getRewardItemCount(participantCount: number, category: TournamentCategory): number {
	const level100ItemCount = TournamentConstants.BASE_LEVEL_100_ITEM_REWARD_COUNT
		+ Math.floor(participantCount / TournamentConstants.ADDITIONAL_ITEM_PARTICIPANT_STEP);
	return category === TournamentCategories.LEVEL_50
		? Math.ceil(level100ItemCount / TournamentConstants.LEVEL_50_REWARD_DIVISOR)
		: level100ItemCount;
}

function getTournamentPhaseEnd(tournament: Tournament): Date {
	return tournament.status === TournamentStatuses.REGISTRATION
		? tournament.registrationEndsAt
		: tournament.combatEndsAt;
}

function getEndingNotificationDate(tournament: Tournament): Date {
	const combatDuration = tournament.combatEndsAt.getTime() - tournament.registrationEndsAt.getTime();
	const configuredLead = hoursToMilliseconds(asHours(TournamentConstants.ENDING_NOTIFICATION_LEAD_HOURS));
	const lead = combatDuration < configuredLead
		? Math.floor(combatDuration / 2)
		: configuredLead;
	return new Date(tournament.combatEndsAt.getTime() - lead);
}

function getGameResult(isWinner: boolean, isDraw: boolean): EloGameResult {
	if (isDraw) {
		return 0.5;
	}
	return isWinner ? 1 : 0;
}

export abstract class TournamentManager {
	public static getCategoryForLevel(level: number): TournamentCategory {
		return getCategoryForLevel(level);
	}

	public static getEffectiveLevel(category: TournamentCategory, level: number): number {
		return getEffectiveLevel(category, level);
	}

	public static getRewardMultiplier(participantCount: number, category: TournamentCategory): number {
		return getRewardMultiplier(participantCount, category);
	}

	public static getRewardItemCount(participantCount: number, category: TournamentCategory): number {
		return getRewardItemCount(participantCount, category);
	}

	public static async generateCode(discordGuildId: string): Promise<{
		code: string; expiresAt: Date;
	}> {
		const code = randomBytes(12).toString("hex")
			.toUpperCase();
		const expiresAt = new Date(Date.now() + daysToMilliseconds(asDays(TournamentConstants.CODE_VALIDITY_DAYS)));
		await TournamentCode.create({
			codeHash: this.hashCode(code),
			discordGuildId,
			expiresAt
		});
		return {
			code, expiresAt
		};
	}

	public static async createTournament(context: PacketContext, code: string, registrationDays: number, combatDays: number): Promise<Tournament> {
		const guildId = context.frontEndSubOrigin;
		const channelId = context.discord?.channel;
		const guildMemberCount = context.discord?.guildMemberCount;
		if (!guildId || guildId === "unknown" || !channelId) {
			throw new TournamentDomainError(TournamentErrorCodes.INVALID_CHANNEL);
		}
		if (context.discord?.isGuildAdministrator !== true) {
			throw new TournamentDomainError(TournamentErrorCodes.ACCESS_DENIED);
		}
		if (guildMemberCount === undefined) {
			throw new TournamentDomainError(TournamentErrorCodes.GUILD_TOO_SMALL);
		}
		if (guildMemberCount < TournamentConstants.MINIMUM_SERVER_MEMBER_COUNT) {
			throw new TournamentDomainError(TournamentErrorCodes.GUILD_TOO_SMALL);
		}
		if (!Number.isInteger(registrationDays)
			|| registrationDays < TournamentConstants.REGISTRATION_MINIMUM_DAYS
			|| registrationDays > TournamentConstants.REGISTRATION_MAXIMUM_DAYS
			|| !Number.isInteger(combatDays)
			|| combatDays < TournamentConstants.COMBAT_MINIMUM_DAYS
			|| combatDays > TournamentConstants.COMBAT_MAXIMUM_DAYS) {
			throw new TournamentDomainError(TournamentErrorCodes.INVALID_DURATION);
		}
		if (!context.keycloakId) {
			throw new TournamentDomainError(TournamentErrorCodes.ACCESS_DENIED);
		}

		const codeHash = this.hashCode(code);
		const codeInstance = await TournamentCode.findOne({ where: { codeHash } });
		if (!codeInstance) {
			throw new TournamentDomainError(TournamentErrorCodes.INVALID_CODE);
		}

		return await TournamentCode.withLocked(codeInstance.id, async lockedCode => {
			const now = Date.now();
			if (lockedCode.consumedAt) {
				throw new TournamentDomainError(TournamentErrorCodes.USED_CODE);
			}
			if (lockedCode.expiresAt.getTime() <= now) {
				throw new TournamentDomainError(TournamentErrorCodes.EXPIRED_CODE);
			}
			if (lockedCode.discordGuildId !== guildId) {
				throw new TournamentDomainError(TournamentErrorCodes.CODE_GUILD_MISMATCH);
			}

			const registrationEndsAt = new Date(now + daysToMilliseconds(asDays(registrationDays)));
			const combatEndsAt = new Date(registrationEndsAt.getTime() + daysToMilliseconds(asDays(combatDays)));
			const tournament = await Tournament.create({
				discordGuildId: guildId,
				discordChannelId: channelId,
				createdByKeycloakId: context.keycloakId,
				status: TournamentStatuses.REGISTRATION,
				pausedFromStatus: null,
				registrationEndsAt,
				combatEndsAt,
				pausedRemainingMs: null,
				startedNotificationSent: false,
				endingNotificationSent: false,
				endedNotificationSent: false,
				rewardsDistributed: false
			});
			lockedCode.consumedAt = new Date(now);
			await lockedCode.save();
			return tournament;
		});
	}

	public static async registerPlayer(context: PacketContext, player: Player): Promise<TournamentParticipant> {
		await this.processDueTournaments();
		const tournament = await this.getTournamentForContext(context);
		if (!tournament || (tournament.status !== TournamentStatuses.REGISTRATION && tournament.status !== TournamentStatuses.COMBAT)) {
			throw new TournamentDomainError(TournamentErrorCodes.NOT_FOUND);
		}

		return await Tournament.withLocked(tournament.id, async lockedTournament => {
			const now = Date.now();
			if (lockedTournament.status === TournamentStatuses.REGISTRATION && now >= lockedTournament.registrationEndsAt.getTime()) {
				throw new TournamentDomainError(TournamentErrorCodes.INVALID_PHASE);
			}
			if (lockedTournament.status === TournamentStatuses.COMBAT && now >= lockedTournament.combatEndsAt.getTime()) {
				throw new TournamentDomainError(TournamentErrorCodes.INVALID_PHASE);
			}

			const existing = await TournamentParticipant.findOne({
				where: {
					tournamentId: lockedTournament.id,
					playerId: player.id
				}
			});
			if (existing) {
				throw new TournamentDomainError(TournamentErrorCodes.ALREADY_REGISTERED);
			}

			const lateRegistration = lockedTournament.status === TournamentStatuses.COMBAT;
			return await TournamentParticipant.create({
				tournamentId: lockedTournament.id,
				playerId: player.id,
				keycloakId: player.keycloakId,
				category: getCategoryForLevel(player.level),
				lateRegistration,
				normalLeagueId: player.getLeague().id,
				attackGloryPoints: TournamentConstants.INITIAL_ATTACK_GLORY,
				defenseGloryPoints: lateRegistration
					? TournamentConstants.LATE_INITIAL_DEFENSE_GLORY
					: TournamentConstants.INITIAL_DEFENSE_GLORY,
				finalRank: null,
				isWinner: false,
				rewardXp: 0,
				rewardMoney: 0,
				rewardItemCount: 0,
				rewardGrantedAt: null,
				registeredAt: new Date(now)
			});
		});
	}

	public static async getTournamentForContext(context: PacketContext): Promise<Tournament | null> {
		return await this.findTournamentForContext(context, false);
	}

	public static async findTournamentForContext(context: PacketContext, includeFinished: boolean): Promise<Tournament | null> {
		if (!Tournament.sequelize) {
			return null;
		}
		const guildId = context.frontEndSubOrigin;
		const channelIds = [context.discord?.channel, context.discord?.parentChannel]
			.filter((channelId): channelId is string => Boolean(channelId));
		if (!guildId || channelIds.length === 0) {
			return null;
		}
		return await Tournament.findOne({
			where: {
				discordGuildId: guildId,
				discordChannelId: { [Op.in]: channelIds },
				status: { [Op.in]: includeFinished ? CONTEXT_STATUSES : ACTIVE_STATUSES }
			},
			order: [["id", "DESC"]]
		});
	}

	public static async getParticipant(tournamentId: number, playerId: number): Promise<TournamentParticipant | null> {
		return await TournamentParticipant.findOne({
			where: {
				tournamentId,
				playerId
			}
		});
	}

	public static async findOpponent(tournament: Tournament, participant: TournamentParticipant): Promise<TournamentParticipant | null> {
		const candidates = await TournamentParticipant.findAll({
			where: {
				tournamentId: tournament.id,
				category: participant.category,
				id: { [Op.ne]: participant.id }
			},
			order: [[literal(`ABS(defenseGloryPoints - ${participant.attackGloryPoints})`), "ASC"], ["registeredAt", "ASC"]]
		});
		const candidateIds = candidates.map(candidate => candidate.id);
		if (candidateIds.length === 0) {
			return null;
		}
		const fights = await TournamentFight.findAll({
			where: {
				tournamentId: tournament.id,
				[Op.or]: [
					{
						attackerParticipantId: participant.id,
						defenderParticipantId: { [Op.in]: candidateIds }
					},
					{
						defenderParticipantId: participant.id,
						attackerParticipantId: { [Op.in]: candidateIds }
					}
				]
			}
		});
		const now = Date.now();
		const recentDefenses = await TournamentFight.findAll({
			where: {
				tournamentId: tournament.id,
				defenderParticipantId: { [Op.in]: candidateIds },
				playedAt: {
					[Op.gt]: new Date(now - minutesToMilliseconds(asMinutes(FightConstants.DEFENDER_COOLDOWN_MINUTES)))
				}
			}
		});
		const recentDefenderIds = new Set(recentDefenses.map(fight => fight.defenderParticipantId));
		for (const candidate of candidates) {
			const cooldownKey = this.getDefenderCooldownKey(tournament.id, candidate.id);
			if ((tournamentDefenderCooldowns.get(cooldownKey) ?? 0) > now || recentDefenderIds.has(candidate.id)) {
				continue;
			}
			const pairFights = fights.filter(fight =>
				(fight.attackerParticipantId === participant.id && fight.defenderParticipantId === candidate.id)
				|| (fight.attackerParticipantId === candidate.id && fight.defenderParticipantId === participant.id));
			const participantWins = pairFights.filter(fight => fight.winnerParticipantId === participant.id).length;
			const candidateWins = pairFights.filter(fight => fight.winnerParticipantId === candidate.id).length;
			if (pairFights.length >= TournamentConstants.BO3_MAX_GAMES
				|| participantWins >= TournamentConstants.BO3_WINS_TO_FINISH
				|| candidateWins >= TournamentConstants.BO3_WINS_TO_FINISH) {
				continue;
			}
			return candidate;
		}
		return null;
	}

	public static async findAndReserveOpponent(tournament: Tournament, participant: TournamentParticipant): Promise<TournamentParticipant | null> {
		let lock = tournamentMatchmakingLocks.get(tournament.id);
		if (!lock) {
			lock = new AsyncLock();
			tournamentMatchmakingLocks.set(tournament.id, lock);
		}
		const release = await lock.acquire();
		try {
			const opponent = await this.findOpponent(tournament, participant);
			if (opponent) {
				this.reserveDefender(tournament.id, opponent.id);
			}
			return opponent;
		}
		finally {
			release();
		}
	}

	public static reserveDefender(tournamentId: number, participantId: number): void {
		tournamentDefenderCooldowns.set(
			this.getDefenderCooldownKey(tournamentId, participantId),
			Date.now() + minutesToMilliseconds(asMinutes(FightConstants.DEFENDER_COOLDOWN_MINUTES))
		);
	}

	public static async verifyCommandAccess(player: Player, context: PacketContext, response: CrowniclesPacket[], access: TournamentCommandAccess): Promise<boolean> {
		await this.processDueTournaments();
		const tournament = await this.findTournamentForContext(context, true);
		if (!tournament) {
			return true;
		}
		if (access === "none") {
			this.pushError(response, TournamentErrorCodes.ACCESS_DENIED);
			return false;
		}
		if (access === "registration") {
			if (tournament.status === TournamentStatuses.REGISTRATION || tournament.status === TournamentStatuses.COMBAT) {
				return true;
			}
			this.pushError(response, tournament.status === TournamentStatuses.PAUSED
				? TournamentErrorCodes.PAUSED
				: TournamentErrorCodes.INVALID_PHASE);
			return false;
		}
		if (tournament.status === TournamentStatuses.PAUSED && access !== "participant") {
			this.pushError(response, TournamentErrorCodes.PAUSED);
			return false;
		}
		const participant = await this.getParticipant(tournament.id, player.id);
		if (!participant) {
			this.pushError(response, TournamentErrorCodes.NOT_REGISTERED);
			return false;
		}
		if (access === "fight" && tournament.status !== TournamentStatuses.COMBAT) {
			this.pushError(response, TournamentErrorCodes.INVALID_PHASE);
			return false;
		}
		if (access === "participant"
			&& tournament.status !== TournamentStatuses.REGISTRATION
			&& tournament.status !== TournamentStatuses.COMBAT
			&& tournament.status !== TournamentStatuses.PAUSED
			&& tournament.status !== TournamentStatuses.COMPLETED
			&& tournament.status !== TournamentStatuses.CANCELLED) {
			this.pushError(response, TournamentErrorCodes.INVALID_PHASE);
			return false;
		}
		return true;
	}

	public static async getStatusData(context: PacketContext, player: Player): Promise<TournamentStatusData> {
		const tournament = await this.findTournamentForContext(context, true);
		if (!tournament) {
			throw new TournamentDomainError(TournamentErrorCodes.NOT_FOUND);
		}
		const participants = await TournamentParticipant.findAll({ where: { tournamentId: tournament.id } });
		const participant = participants.find(candidate => candidate.playerId === player.id);
		return {
			tournamentId: tournament.id,
			status: tournament.status,
			registrationEndsAt: tournament.registrationEndsAt.getTime(),
			combatEndsAt: tournament.combatEndsAt.getTime(),
			participantCount: participants.length,
			categoryCounts: getCategoryCounts(participants),
			category: participant?.category,
			attackGloryPoints: participant?.attackGloryPoints,
			defenseGloryPoints: participant?.defenseGloryPoints
		};
	}

	public static async getTopData(context: PacketContext, player: Player, requestedPage?: number): Promise<TournamentTopData> {
		const tournament = await this.findTournamentForContext(context, true);
		if (!tournament) {
			throw new TournamentDomainError(TournamentErrorCodes.NOT_FOUND);
		}
		const participants = await TournamentParticipant.findAll({ where: { tournamentId: tournament.id } });
		const playerInstances = await Player.findAll({
			where: { id: { [Op.in]: participants.map(participant => participant.playerId) } }
		});
		const playersById = new Map(playerInstances.map(playerInstance => [playerInstance.id, playerInstance]));
		const sortedParticipantsByCategory = Object.values(TournamentCategories).map(category => ({
			category,
			participants: this.sortParticipants(participants.filter(participant => participant.category === category), playersById)
		}));
		const totalParticipants = Math.max(0, ...sortedParticipantsByCategory.map(category => category.participants.length));
		const totalPages = Math.max(1, Math.ceil(totalParticipants / TournamentConstants.TOP_ELEMENTS_PER_PAGE));
		const pageNumber = Math.min(Math.max(requestedPage ?? 1, 1), totalPages);
		return {
			tournamentId: tournament.id,
			pageNumber,
			totalPages,
			elementsPerPage: TournamentConstants.TOP_ELEMENTS_PER_PAGE,
			categories: sortedParticipantsByCategory.map(({ category, participants: categoryParticipants }) => {
				const pageStart = (pageNumber - 1) * TournamentConstants.TOP_ELEMENTS_PER_PAGE;
				const pageParticipants = categoryParticipants.slice(pageStart, pageStart + TournamentConstants.TOP_ELEMENTS_PER_PAGE);
				return {
					category,
					totalParticipants: categoryParticipants.length,
					yourRank: categoryParticipants.findIndex(participant => participant.playerId === player.id) + 1 || undefined,
					elements: pageParticipants.map((participant, index) => ({
						playerKeycloakId: participant.keycloakId,
						rank: pageStart + index + 1,
						category,
						attackGloryPoints: participant.attackGloryPoints,
						defenseGloryPoints: participant.defenseGloryPoints,
						totalGloryPoints: participant.getTotalGloryPoints(),
						effectiveLevel: getEffectiveLevel(category, playersById.get(participant.playerId)?.level ?? 0)
					}))
				};
			})
		};
	}

	public static async pauseTournament(tournamentId: number): Promise<void> {
		await Tournament.withLocked(tournamentId, async tournament => {
			if (tournament.status !== TournamentStatuses.REGISTRATION && tournament.status !== TournamentStatuses.COMBAT) {
				return;
			}
			const remainingMs = Math.max(0, getTournamentPhaseEnd(tournament).getTime() - Date.now());
			tournament.pausedFromStatus = tournament.status;
			tournament.pausedRemainingMs = remainingMs;
			tournament.status = TournamentStatuses.PAUSED;
			await tournament.save();
		});
	}

	public static async pauseTournamentForChannel(discordGuildId: string, discordChannelId: string): Promise<void> {
		const tournament = await Tournament.findOne({
			where: {
				discordGuildId,
				discordChannelId,
				status: { [Op.in]: [TournamentStatuses.REGISTRATION, TournamentStatuses.COMBAT] }
			}
		});
		if (tournament) {
			await this.pauseTournament(tournament.id);
		}
	}

	public static async resumeTournament(tournamentId: number, context: PacketContext): Promise<Tournament> {
		const channelId = context.discord?.channel;
		if (!channelId || !context.frontEndSubOrigin) {
			throw new TournamentDomainError(TournamentErrorCodes.INVALID_CHANNEL);
		}
		if (context.discord?.isBotOwner !== true) {
			throw new TournamentDomainError(TournamentErrorCodes.ACCESS_DENIED);
		}
		return await Tournament.withLocked(tournamentId, async tournament => {
			if (tournament.status !== TournamentStatuses.PAUSED || !tournament.pausedFromStatus) {
				throw new TournamentDomainError(TournamentErrorCodes.INVALID_PHASE);
			}
			if (tournament.discordGuildId !== context.frontEndSubOrigin) {
				throw new TournamentDomainError(TournamentErrorCodes.CODE_GUILD_MISMATCH);
			}
			const remainingMs = tournament.pausedRemainingMs ?? 0;
			const previousStatus = tournament.pausedFromStatus;
			if (previousStatus === TournamentStatuses.REGISTRATION) {
				const combatDuration = tournament.combatEndsAt.getTime() - tournament.registrationEndsAt.getTime();
				tournament.registrationEndsAt = new Date(Date.now() + remainingMs);
				tournament.combatEndsAt = new Date(tournament.registrationEndsAt.getTime() + combatDuration);
			}
			else {
				tournament.combatEndsAt = new Date(Date.now() + remainingMs);
			}
			tournament.discordGuildId = context.frontEndSubOrigin;
			tournament.discordChannelId = channelId;
			tournament.status = previousStatus;
			tournament.pausedFromStatus = null;
			tournament.pausedRemainingMs = null;
			await tournament.save();
			return tournament;
		});
	}

	public static async cancelTournament(tournamentId: number, discordGuildId: string, reason: string, isGuildAdministrator: boolean): Promise<void> {
		if (!isGuildAdministrator) {
			throw new TournamentDomainError(TournamentErrorCodes.ACCESS_DENIED);
		}
		let participants: TournamentParticipant[] = [];
		await Tournament.withLocked(tournamentId, async tournament => {
			if (tournament.status === TournamentStatuses.COMPLETED || tournament.status === TournamentStatuses.CANCELLED) {
				return;
			}
			if (tournament.discordGuildId !== discordGuildId) {
				throw new TournamentDomainError(TournamentErrorCodes.CODE_GUILD_MISMATCH);
			}
			participants = await TournamentParticipant.findAll({ where: { tournamentId } });
			tournament.status = TournamentStatuses.CANCELLED;
			tournament.rewardsDistributed = true;
			tournament.endedNotificationSent = true;
			await tournament.save();
		});
		if (participants.length > 0) {
			await this.sendTournamentEvent(tournamentId, participants, {
				event: TournamentNotificationEvents.ENDED,
				cancellationReason: reason
			});
		}
	}

	public static async processDueTournaments(): Promise<void> {
		if (!Tournament.sequelize) {
			return;
		}
		const tournaments = await Tournament.findAll({
			where: { status: { [Op.in]: PROCESSABLE_STATUSES } }
		});
		for (const tournament of tournaments) {
			try {
				if (tournament.status === TournamentStatuses.REGISTRATION && Date.now() >= tournament.registrationEndsAt.getTime()) {
					await this.advanceRegistration(tournament.id);
				}
				else if (tournament.status === TournamentStatuses.COMBAT) {
					if (Date.now() >= tournament.combatEndsAt.getTime()) {
						await this.finishTournament(tournament.id);
					}
					else {
						await this.sendEndingNotificationIfDue(tournament.id);
					}
				}
				else if (tournament.status === TournamentStatuses.COMPLETED && !tournament.rewardsDistributed) {
					await this.distributeRewards(tournament.id);
					await this.sendEndedNotificationIfReady(tournament.id);
				}
			}
			catch (error) {
				CrowniclesLogger.errorWithObj(`Tournament ${tournament.id} processing failed`, error);
			}
		}
	}

	public static async resolveFight(fight: FightController, response: CrowniclesPacket[]): Promise<void> {
		const fightContext = fight.tournamentContext;
		if (!fightContext) {
			return;
		}
		const isDraw = fight.isADraw();
		const winner = fight.getWinnerFighter();
		const attackerWon = !isDraw && winner === fight.fightInitiator;
		const gloryChanges = await withLockedEntities(
			[
				Tournament.lockKey(fightContext.tournamentId),
				TournamentParticipant.lockKey(fightContext.attackerParticipantId),
				TournamentParticipant.lockKey(fightContext.defenderParticipantId)
			] as const,
			async ([
				tournament,
				attacker,
				defender
			]) => {
				if (await TournamentFight.findOne({ where: { fightId: fight.id } })) {
					return null;
				}
				if (tournament.status !== TournamentStatuses.COMBAT || Date.now() >= tournament.combatEndsAt.getTime()) {
					return null;
				}
				if (attacker.tournamentId !== tournament.id
					|| defender.tournamentId !== tournament.id
					|| attacker.category !== fightContext.category
					|| defender.category !== fightContext.category) {
					return null;
				}
				const attackerResult = getGameResult(attackerWon, isDraw);
				const defenderResult = getGameResult(!attackerWon, isDraw);
				const oldAttackerAttack = attacker.attackGloryPoints;
				const oldAttackerDefense = attacker.defenseGloryPoints;
				const oldDefenderAttack = defender.attackGloryPoints;
				const oldDefenderDefense = defender.defenseGloryPoints;
				const newAttackerAttack = EloUtils.calculateNewRating(
					attacker.attackGloryPoints,
					defender.defenseGloryPoints,
					attackerResult,
					EloUtils.getKFactorFromGlory(attacker.getTotalGloryPoints())
				);
				const newDefenderDefense = EloUtils.calculateNewRating(
					defender.defenseGloryPoints,
					attacker.attackGloryPoints,
					defenderResult,
					EloUtils.getKFactorFromGlory(defender.getTotalGloryPoints())
				);
				attacker.attackGloryPoints = newAttackerAttack;
				defender.defenseGloryPoints = newDefenderDefense;
				await Promise.all([attacker.save(), defender.save()]);
				const gloryChanges = {
					attackerKeycloakId: attacker.keycloakId,
					attackerGlory: newAttackerAttack,
					defenderKeycloakId: defender.keycloakId,
					defenderGlory: newDefenderDefense
				};
				await TournamentFight.create({
					fightId: fight.id,
					tournamentId: tournament.id,
					attackerParticipantId: attacker.id,
					defenderParticipantId: defender.id,
					winnerParticipantId: isDraw ? null : attackerWon ? attacker.id : defender.id,
					draw: isDraw,
					playedAt: new Date()
				});
				response.push(makePacket(TournamentFightRewardPacket, {
					player1: {
						keycloakId: attacker.keycloakId,
						category: attacker.category,
						oldAttackGloryPoints: oldAttackerAttack,
						newAttackGloryPoints: newAttackerAttack,
						oldDefenseGloryPoints: oldAttackerDefense,
						newDefenseGloryPoints: attacker.defenseGloryPoints
					},
					player2: {
						keycloakId: defender.keycloakId,
						category: defender.category,
						oldAttackGloryPoints: oldDefenderAttack,
						newAttackGloryPoints: defender.attackGloryPoints,
						oldDefenseGloryPoints: oldDefenderDefense,
						newDefenseGloryPoints: newDefenderDefense
					},
					draw: isDraw,
					winnerKeycloakId: isDraw ? undefined : attackerWon ? attacker.keycloakId : defender.keycloakId
				}));
				return gloryChanges;
			}
		);
		if (gloryChanges) {
			try {
				await Promise.all([
					crowniclesInstance?.logsDatabase.logPlayersAttackGloryPoints(gloryChanges.attackerKeycloakId, gloryChanges.attackerGlory, NumberChangeReason.TOURNAMENT_FIGHT),
					crowniclesInstance?.logsDatabase.logPlayersDefenseGloryPoints(gloryChanges.defenderKeycloakId, gloryChanges.defenderGlory, NumberChangeReason.TOURNAMENT_FIGHT)
				]);
			}
			catch (error) {
				CrowniclesLogger.errorWithObj("Tournament glory log failed after fight commit", error);
			}
		}
	}

	private static hashCode(code: string): string {
		return createHash("sha256").update(code.trim().toUpperCase())
			.digest("hex");
	}

	private static getDefenderCooldownKey(tournamentId: number, participantId: number): string {
		return `${tournamentId}:${participantId}`;
	}

	private static pushError(response: CrowniclesPacket[], errorCode: TournamentErrorCode): void {
		response.push(makePacket(CommandTournamentErrorPacketRes, { errorCode }));
	}

	private static async advanceRegistration(tournamentId: number): Promise<void> {
		let participants: TournamentParticipant[] = [];
		let event: TournamentEventData | null = null;
		await Tournament.withLocked(tournamentId, async tournament => {
			if (tournament.status !== TournamentStatuses.REGISTRATION || Date.now() < tournament.registrationEndsAt.getTime()) {
				return;
			}
			participants = await TournamentParticipant.findAll({ where: { tournamentId } });
			const categoryCounts = getCategoryCounts(participants);
			if (participants.length < TournamentConstants.MINIMUM_TOTAL_PARTICIPANTS
				|| categoryCounts[TournamentCategories.LEVEL_50] < TournamentConstants.MINIMUM_PARTICIPANTS_PER_CATEGORY
				|| categoryCounts[TournamentCategories.LEVEL_100] < TournamentConstants.MINIMUM_PARTICIPANTS_PER_CATEGORY) {
				tournament.status = TournamentStatuses.CANCELLED;
				tournament.rewardsDistributed = true;
				tournament.endedNotificationSent = true;
				event = {
					event: TournamentNotificationEvents.ENDED,
					cancellationReason: "tooFewParticipants"
				};
			}
			else {
				tournament.status = TournamentStatuses.COMBAT;
				tournament.startedNotificationSent = true;
				event = { event: TournamentNotificationEvents.STARTED };
			}
			await tournament.save();
		});
		if (event) {
			await this.sendTournamentEvent(tournamentId, participants, event);
		}
	}

	private static async sendEndingNotificationIfDue(tournamentId: number): Promise<void> {
		let participants: TournamentParticipant[] = [];
		let shouldSend = false;
		await Tournament.withLocked(tournamentId, async tournament => {
			if (tournament.status !== TournamentStatuses.COMBAT
				|| tournament.endingNotificationSent
				|| Date.now() < getEndingNotificationDate(tournament).getTime()) {
				return;
			}
			participants = await TournamentParticipant.findAll({ where: { tournamentId } });
			tournament.endingNotificationSent = true;
			await tournament.save();
			shouldSend = true;
		});
		if (shouldSend) {
			await this.sendTournamentEvent(tournamentId, participants, {
				event: TournamentNotificationEvents.ENDING
			});
		}
	}

	private static async finishTournament(tournamentId: number): Promise<void> {
		await Tournament.withLocked(tournamentId, async tournament => {
			if (tournament.status !== TournamentStatuses.COMBAT || Date.now() < tournament.combatEndsAt.getTime()) {
				return;
			}
			const participants = await TournamentParticipant.findAll({ where: { tournamentId } });
			const players = await Player.findAll({
				where: { id: { [Op.in]: participants.map(participant => participant.playerId) } }
			});
			const playersById = new Map(players.map(player => [player.id, player]));
			const participantCount = participants.length;
			for (const category of Object.values(TournamentCategories)) {
				const categoryParticipants = this.sortParticipants(participants.filter(participant => participant.category === category), playersById);
				for (const [index, participant] of categoryParticipants.entries()) {
					const league = LeagueDataController.instance.getById(participant.normalLeagueId)
						?? playersById.get(participant.playerId)?.getLeague();
					const rewardMultiplier = getRewardMultiplier(participantCount, category);
					participant.finalRank = index + 1;
					participant.isWinner = index === 0;
					participant.rewardXp = league ? Math.round(league.getXPToAward() * rewardMultiplier) : 0;
					participant.rewardMoney = league ? Math.round(league.getMoneyToAward() * rewardMultiplier) : 0;
					participant.rewardItemCount = getRewardItemCount(participantCount, category);
					await participant.save();
				}
			}
			tournament.status = TournamentStatuses.COMPLETED;
			await tournament.save();
		});
		await this.distributeRewards(tournamentId);
		await this.sendEndedNotificationIfReady(tournamentId);
	}

	private static async distributeRewards(tournamentId: number): Promise<void> {
		const participants = await TournamentParticipant.findAll({ where: { tournamentId } });
		for (const participant of participants) {
			if (participant.rewardGrantedAt) {
				continue;
			}
			try {
				await withLockedEntities(
					[Player.lockKey(participant.playerId), TournamentParticipant.lockKey(participant.id)] as const,
					async ([player, lockedParticipant]) => {
						if (lockedParticipant.rewardGrantedAt) {
							return;
						}
						await this.applyTournamentRewardUnderLock(player, lockedParticipant);
					}
				);
			}
			catch (error) {
				if (error instanceof LockedRowNotFoundError) {
					CrowniclesLogger.warn(`Tournament reward skipped because player ${participant.playerId} no longer exists`);
				}
				else {
					CrowniclesLogger.errorWithObj(`Tournament reward for participant ${participant.id} failed`, error);
				}
			}
		}
		const remaining = await TournamentParticipant.count({
			where: {
				tournamentId,
				rewardGrantedAt: null
			}
		});
		if (remaining === 0) {
			await Tournament.withLocked(tournamentId, async tournament => {
				tournament.rewardsDistributed = true;
				await tournament.save();
			});
		}
	}

	private static async applyTournamentRewardUnderLock(player: Player, participant: Locked<TournamentParticipant>): Promise<void> {
		const response: CrowniclesPacket[] = [];
		await player.addExperience({
			amount: participant.rewardXp,
			response,
			reason: NumberChangeReason.TOURNAMENT_REWARD
		});
		await player.addMoney({
			amount: participant.rewardMoney,
			response,
			reason: NumberChangeReason.TOURNAMENT_REWARD,
			ignoreBlessing: true
		});
		if (participant.isWinner) {
			await PlayerBadgesManager.addBadge(player.id, Badge.TOURNAMENT_WINNER);
		}
		const league = LeagueDataController.instance.getById(participant.normalLeagueId) ?? player.getLeague();
		for (let index = 0; index < participant.rewardItemCount; index++) {
			const item = league.generateRewardItem();
			const added = await player.giveItem(item, generateRandomLootLevel(), generateRandomLootEnchantment(item));
			if (!added) {
				CrowniclesLogger.warn(`Tournament item reward could not fit in player ${player.id} inventory`);
			}
			else {
				crowniclesInstance?.logsDatabase.logItemGain(player.keycloakId, item)
					.then();
			}
		}
		participant.rewardGrantedAt = new Date();
		await participant.save();
	}

	private static async sendEndedNotificationIfReady(tournamentId: number): Promise<void> {
		let participants: TournamentParticipant[] = [];
		let shouldSend = false;
		await Tournament.withLocked(tournamentId, async tournament => {
			if (tournament.status !== TournamentStatuses.COMPLETED
				|| !tournament.rewardsDistributed
				|| tournament.endedNotificationSent) {
				return;
			}
			participants = await TournamentParticipant.findAll({ where: { tournamentId } });
			tournament.endedNotificationSent = true;
			await tournament.save();
			shouldSend = true;
		});
		if (shouldSend) {
			await this.sendTournamentEvent(tournamentId, participants, {
				event: TournamentNotificationEvents.ENDED
			});
		}
	}

	private static sendTournamentEvent(tournamentId: number, participants: TournamentParticipant[], eventData: TournamentEventData): void {
		if (participants.length === 0) {
			return;
		}
		const categoryCounts = getCategoryCounts(participants);
		const winnersByCategory = new Map(
			Object.values(TournamentCategories).map(category => [
				category,
				participants.find(participant => participant.category === category && participant.isWinner)?.keycloakId
			])
		);
		PacketUtils.sendNotifications(participants.map(participant => makePacket(TournamentNotificationPacket, {
			keycloakId: participant.keycloakId,
			event: eventData.event,
			tournamentId,
			category: participant.category,
			participantCount: participants.length,
			categoryParticipantCount: categoryCounts[participant.category],
			winnerKeycloakId: winnersByCategory.get(participant.category),
			rank: participant.finalRank ?? undefined,
			xp: participant.rewardXp || undefined,
			money: participant.rewardMoney || undefined,
			itemCount: participant.rewardItemCount || undefined,
			cancellationReason: eventData.cancellationReason
		})));
	}

	private static sortParticipants(participants: TournamentParticipant[], playersById: Map<number, Player>): TournamentParticipant[] {
		return [...participants].sort((left, right) => {
			const gloryDifference = right.getTotalGloryPoints() - left.getTotalGloryPoints();
			if (gloryDifference !== 0) {
				return gloryDifference;
			}
			const leftLevel = getEffectiveLevel(left.category, playersById.get(left.playerId)?.level ?? 0);
			const rightLevel = getEffectiveLevel(right.category, playersById.get(right.playerId)?.level ?? 0);
			return rightLevel - leftLevel || left.playerId - right.playerId;
		});
	}
}
