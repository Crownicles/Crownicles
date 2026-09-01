import { Op } from "sequelize";
import { TournamentConstants } from "../../../../Lib/src/constants/TournamentConstants";
import {
	TournamentCategories, TournamentNotificationEvents, TournamentStatuses
} from "../../../../Lib/src/types/Tournament";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";
import {
	LockKey, withLockedEntities
} from "../../../../Lib/src/locks/withLockedEntities";
import { Tournament } from "../database/game/models/Tournament";
import { TournamentParticipant } from "../database/game/models/TournamentParticipant";
import Player from "../database/game/models/Player";
import { LeagueDataController } from "../../data/League";
import {
	getCategoryCounts, getEndingNotificationDate, getRewardItemCount,
	getRewardMultiplier, PROCESSABLE_STATUSES, sortParticipants
} from "./TournamentRules";
import {
	sendTournamentEvent, TournamentEventData
} from "./TournamentNotifications";
import { distributeRewards } from "./TournamentRewards";

type TournamentRewardPreparationContext = {
	playersById: Map<number, Player>;
	category: typeof TournamentCategories[keyof typeof TournamentCategories];
	participantCount: number;
};

type TournamentNotificationConfiguration = {
	isReady: (tournament: Tournament) => boolean;
	markSent: (tournament: Tournament) => void;
	eventData: TournamentEventData;
};

function prepareParticipantReward(
	participant: TournamentParticipant,
	index: number,
	context: TournamentRewardPreparationContext
): void {
	const league = LeagueDataController.instance.getById(participant.normalLeagueId)
		?? context.playersById.get(participant.playerId)?.getLeague();
	const rewardMultiplier = getRewardMultiplier(context.participantCount, context.category);
	participant.finalRank = index + 1;
	participant.isWinner = index === 0;
	participant.rewardXp = league ? Math.round(league.getXPToAward() * rewardMultiplier) : 0;
	participant.rewardMoney = league ? Math.round(league.getMoneyToAward() * rewardMultiplier) : 0;
	participant.rewardItemCount = getRewardItemCount(context.participantCount, context.category);
}

class TournamentParticipantsChangedError extends Error {
}

function getLockedTournamentEntities(
	entities: unknown[],
	participantCount: number
): {
	tournament: Tournament;
	participants: TournamentParticipant[];
} {
	const tournament = entities.find((entity): entity is Tournament => entity instanceof Tournament);
	const participants = entities.filter((entity): entity is TournamentParticipant => entity instanceof TournamentParticipant);
	if (!tournament || participants.length !== participantCount) {
		throw new TournamentParticipantsChangedError();
	}
	return {
		tournament,
		participants
	};
}

async function assertParticipantSnapshotIsCurrent(tournamentId: number, participantIds: number[]): Promise<void> {
	const participantIdSet = new Set(participantIds);
	const currentParticipants = await TournamentParticipant.findAll({ where: { tournamentId } });
	if (currentParticipants.some(participant => !participantIdSet.has(participant.id))) {
		throw new TournamentParticipantsChangedError();
	}
}

async function freezeTournamentAttempt(tournamentId: number, participantIds: number[]): Promise<void> {
	const lockKeys: LockKey[] = [
		Tournament.lockKey(tournamentId),
		...participantIds.map(participantId => TournamentParticipant.lockKey(participantId))
	];
	await withLockedEntities(lockKeys, async entities => {
		const {
			tournament,
			participants
		} = getLockedTournamentEntities(entities, participantIds.length);
		await assertParticipantSnapshotIsCurrent(tournamentId, participantIds);
		if (tournament.status !== TournamentStatuses.COMBAT || Date.now() < tournament.combatEndsAt.getTime()) {
			return;
		}
		const players = await Player.findAll({
			where: { id: { [Op.in]: participants.map(participant => participant.playerId) } }
		});
		const playersById = new Map(players.map(player => [player.id, player]));
		const participantCount = participants.length;
		for (const category of Object.values(TournamentCategories)) {
			const categoryParticipants = sortParticipants(participants.filter(participant => participant.category === category), playersById);
			for (const [index, participant] of categoryParticipants.entries()) {
				prepareParticipantReward(participant, index, {
					playersById,
					category,
					participantCount
				});
				await participant.save();
			}
		}
		tournament.status = TournamentStatuses.COMPLETED;
		await tournament.save();
	});
}

async function advanceRegistration(tournamentId: number): Promise<void> {
	let participants: TournamentParticipant[] = [];
	let event: TournamentEventData | null = null;
	await Tournament.withLocked(tournamentId, async tournament => {
		if (tournament.status !== TournamentStatuses.REGISTRATION || Date.now() < tournament.registrationEndsAt.getTime()) {
			return;
		}
		participants = await TournamentParticipant.findAll({ where: { tournamentId } });
		const categoryCounts = getCategoryCounts(participants);
		const hasEnoughParticipants = participants.length >= TournamentConstants.MINIMUM_TOTAL_PARTICIPANTS
			&& categoryCounts[TournamentCategories.LEVEL_50] >= TournamentConstants.MINIMUM_PARTICIPANTS_PER_CATEGORY
			&& categoryCounts[TournamentCategories.LEVEL_100] >= TournamentConstants.MINIMUM_PARTICIPANTS_PER_CATEGORY;
		if (!hasEnoughParticipants) {
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
		sendTournamentEvent(tournamentId, participants, event);
	}
}

async function sendTournamentNotificationIfReady(
	tournamentId: number,
	configuration: TournamentNotificationConfiguration
): Promise<void> {
	let participants: TournamentParticipant[] = [];
	let shouldSend = false;
	await Tournament.withLocked(tournamentId, async tournament => {
		if (!configuration.isReady(tournament)) {
			return;
		}
		participants = await TournamentParticipant.findAll({ where: { tournamentId } });
		configuration.markSent(tournament);
		await tournament.save();
		shouldSend = true;
	});
	if (shouldSend) {
		sendTournamentEvent(tournamentId, participants, configuration.eventData);
	}
}

function isEndingNotificationReady(tournament: Tournament): boolean {
	return tournament.status === TournamentStatuses.COMBAT
		&& !tournament.endingNotificationSent
		&& Date.now() >= getEndingNotificationDate(tournament).getTime();
}

function markEndingNotificationSent(tournament: Tournament): void {
	tournament.endingNotificationSent = true;
}

function isEndedNotificationReady(tournament: Tournament): boolean {
	return tournament.status === TournamentStatuses.COMPLETED
		&& tournament.rewardsDistributed
		&& !tournament.endedNotificationSent;
}

function markEndedNotificationSent(tournament: Tournament): void {
	tournament.endedNotificationSent = true;
}

async function sendEndingNotificationIfDue(tournamentId: number): Promise<void> {
	await sendTournamentNotificationIfReady(tournamentId, {
		isReady: isEndingNotificationReady,
		markSent: markEndingNotificationSent,
		eventData: { event: TournamentNotificationEvents.ENDING }
	});
}

async function sendEndedNotificationIfReady(tournamentId: number): Promise<void> {
	await sendTournamentNotificationIfReady(tournamentId, {
		isReady: isEndedNotificationReady,
		markSent: markEndedNotificationSent,
		eventData: { event: TournamentNotificationEvents.ENDED }
	});
}

async function freezeTournament(tournamentId: number): Promise<void> {
	while (true) {
		const participantIds = (await TournamentParticipant.findAll({ where: { tournamentId } }))
			.map(participant => participant.id);
		try {
			await freezeTournamentAttempt(tournamentId, participantIds);
			return;
		}
		catch (error) {
			if (!(error instanceof TournamentParticipantsChangedError)) {
				throw error;
			}
		}
	}
}

async function finishTournament(tournamentId: number): Promise<void> {
	await sendEndingNotificationIfDue(tournamentId);
	await freezeTournament(tournamentId);
	await distributeRewards(tournamentId);
	await sendEndedNotificationIfReady(tournamentId);
}

async function processDueTournament(tournament: Tournament): Promise<void> {
	if (tournament.status === TournamentStatuses.REGISTRATION
		&& Date.now() >= tournament.registrationEndsAt.getTime()) {
		await advanceRegistration(tournament.id);
		return;
	}
	if (tournament.status === TournamentStatuses.COMBAT) {
		if (Date.now() >= tournament.combatEndsAt.getTime()) {
			await finishTournament(tournament.id);
		}
		else {
			await sendEndingNotificationIfDue(tournament.id);
		}
		return;
	}
	if (tournament.status === TournamentStatuses.COMPLETED && !tournament.rewardsDistributed) {
		await distributeRewards(tournament.id);
		await sendEndedNotificationIfReady(tournament.id);
	}
}

export async function processDueTournaments(): Promise<void> {
	if (!Tournament.sequelize) {
		return;
	}
	const tournaments = await Tournament.findAll({
		where: { status: { [Op.in]: PROCESSABLE_STATUSES } }
	});
	for (const tournament of tournaments) {
		try {
			await processDueTournament(tournament);
		}
		catch (error) {
			CrowniclesLogger.errorWithObj(`Tournament ${tournament.id} processing failed`, error);
		}
	}
}
