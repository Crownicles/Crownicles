import { Op } from "sequelize";
import type {
	CrowniclesPacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { ItemFoundPacket } from "../../../../Lib/src/packets/events/ItemFoundPacket";
import {
	TournamentCategories,
	TournamentLevelLimitModes,
	TournamentStatuses
} from "../../../../Lib/src/types/Tournament";
import {
	asDays, daysToMilliseconds
} from "../../../../Lib/src/utils/TimeUtils";
import {
	createTournament, generateTournamentCode
} from "./TournamentCreation";
import { registerPlayer } from "./TournamentRegistration";
import {
	pauseTournament, resumeTournament
} from "./TournamentPause";
import { cancelTournament } from "./TournamentCancellation";
import { processDueTournaments } from "./TournamentLifecycle";
import { getCategoryForLevel } from "./TournamentRules";
import { resolveTournamentFight } from "./TournamentFightResolver";
import { claimTournamentReward } from "./TournamentRewards";
import Player from "../database/game/models/Player";
import { InventoryInfo } from "../database/game/models/InventoryInfo";
import { InventorySlot } from "../database/game/models/InventorySlot";
import { PlayerBadges } from "../database/game/models/PlayerBadges";
import { Tournament } from "../database/game/models/Tournament";
import { TournamentCode } from "../database/game/models/TournamentCode";
import { TournamentFight } from "../database/game/models/TournamentFight";
import { TournamentParticipant } from "../database/game/models/TournamentParticipant";

const TEST_PLAYER_PREFIX = "tournament-test-";
const TEST_REGISTRATION_DAYS = 1;
const TEST_COMBAT_DAYS = 1;
const TEST_LEVEL_50 = 50;
const TEST_LEVEL_100 = 100;
const TEST_INVENTORY_SLOTS = 10;
const TEST_PHASE_DURATION_MS = daysToMilliseconds(asDays(TEST_COMBAT_DAYS));

export type TournamentTestPhase = "registration" | "combat" | "paused" | "resume" | "completed" | "cancelled";
export type TournamentTestRewardAction = "finish" | "claim" | "claimall" | "retry";

export type TournamentTestFixture = {
	tournament: Tournament;
	participants: TournamentParticipant[];
	players: Player[];
};

function getTestPlayerKeycloakId(fixtureId: string, index: number): string {
	return `${TEST_PLAYER_PREFIX}${fixtureId}-${index}`;
}

function isTestPlayerKeycloakId(keycloakId: string): boolean {
	return keycloakId.startsWith(TEST_PLAYER_PREFIX);
}

function getPlayerContext(context: PacketContext, keycloakId: string): PacketContext {
	return {
		...context,
		keycloakId
	};
}

async function getFixtureCandidates(context: PacketContext): Promise<Tournament[]> {
	return await Tournament.findAll({
		where: {
			discordGuildId: context.frontEndSubOrigin,
			discordChannelId: context.discord?.channel,
			createdByKeycloakId: context.keycloakId
		},
		order: [["id", "DESC"]]
	});
}

async function isTestFixture(tournamentId: number): Promise<boolean> {
	return await TournamentParticipant.findOne({
		where: {
			tournamentId,
			keycloakId: { [Op.like]: `${TEST_PLAYER_PREFIX}%` }
		}
	}) !== null;
}

async function loadFixture(tournament: Tournament): Promise<TournamentTestFixture> {
	// The caller often mutated the tournament through a lock, so the in-memory instance is stale
	await tournament.reload();
	const participants = await TournamentParticipant.findAll({
		where: { tournamentId: tournament.id },
		order: [["id", "ASC"]]
	});
	const players = await Player.findAll({
		where: { id: { [Op.in]: participants.map(participant => participant.playerId) } }
	});
	return {
		tournament,
		participants,
		players
	};
}

export async function findLatestTournamentFixture(context: PacketContext): Promise<TournamentTestFixture> {
	for (const tournament of await getFixtureCandidates(context)) {
		if (await isTestFixture(tournament.id)) {
			return await loadFixture(tournament);
		}
	}
	throw new Error("Aucune fixture tournoi trouvée. Lancez /test tournamentsetup.");
}

export async function cleanupTournamentFixtures(context: PacketContext): Promise<number> {
	let deletedFixtures = 0;
	for (const tournament of await getFixtureCandidates(context)) {
		if (!await isTestFixture(tournament.id)) {
			continue;
		}
		const participants = await TournamentParticipant.findAll({ where: { tournamentId: tournament.id } });
		const fakePlayerIds = participants
			.filter(participant => isTestPlayerKeycloakId(participant.keycloakId))
			.map(participant => participant.playerId);
		await TournamentFight.destroy({ where: { tournamentId: tournament.id } });
		await TournamentParticipant.destroy({ where: { tournamentId: tournament.id } });
		if (fakePlayerIds.length > 0) {
			await PlayerBadges.destroy({ where: { playerId: { [Op.in]: fakePlayerIds } } });
			await InventorySlot.destroy({ where: { playerId: { [Op.in]: fakePlayerIds } } });
			await InventoryInfo.destroy({ where: { playerId: { [Op.in]: fakePlayerIds } } });
			await Player.destroy({ where: { id: { [Op.in]: fakePlayerIds } } });
		}
		await Tournament.destroy({ where: { id: tournament.id } });
		await TournamentCode.destroy({
			where: {
				discordGuildId: context.frontEndSubOrigin,
				createdAt: {
					[Op.between]: [
						new Date(tournament.createdAt.getTime() - 10_000),
						new Date(tournament.createdAt.getTime() + 10_000)
					]
				}
			}
		});
		deletedFixtures++;
	}
	return deletedFixtures;
}

async function createFixturePlayers(player: Player): Promise<Player[]> {
	if (player.level < 8) {
		player.level = 30;
		await player.save();
	}
	const currentCategory = getCategoryForLevel(player.level);
	const level50FakePlayers = currentCategory === TournamentCategories.LEVEL_50 ? 9 : 10;
	const fixtureId = `${Date.now().toString(36)}-${player.id}`;
	const fakePlayers = await Promise.all(Array.from({ length: 19 }, (_, index) => {
		const level = index < level50FakePlayers ? TEST_LEVEL_50 : TEST_LEVEL_100;
		return Player.create({
			keycloakId: getTestPlayerKeycloakId(fixtureId, index),
			level
		});
	}));
	return [player, ...fakePlayers];
}

async function prepareInventory(players: Player[]): Promise<void> {
	await Promise.all(players.map(player => InventoryInfo.upsert({
		playerId: player.id,
		weaponSlots: TEST_INVENTORY_SLOTS,
		armorSlots: TEST_INVENTORY_SLOTS,
		potionSlots: TEST_INVENTORY_SLOTS,
		objectSlots: TEST_INVENTORY_SLOTS,
		plantSlots: 1
	})));
}

export async function createTournamentFixture(context: PacketContext, player: Player): Promise<TournamentTestFixture> {
	await cleanupTournamentFixtures(context);
	const code = await generateTournamentCode(context.frontEndSubOrigin);
	const tournament = await createTournament({
		context,
		code: code.code,
		duration: {
			registrationDays: TEST_REGISTRATION_DAYS,
			combatDays: TEST_COMBAT_DAYS
		},
		levelLimitMode: TournamentLevelLimitModes.CATEGORY
	});
	const players = await createFixturePlayers(player);
	const participants: TournamentParticipant[] = [];
	for (const fixturePlayer of players) {
		participants.push(await registerPlayer(getPlayerContext(context, fixturePlayer.keycloakId), fixturePlayer));
	}
	await TournamentParticipant.update({ normalLeagueId: 10 }, { where: { tournamentId: tournament.id } });
	await prepareInventory(players);
	return await loadFixture(tournament);
}

export async function forceTournamentPhase(context: PacketContext, phase: TournamentTestPhase): Promise<TournamentTestFixture> {
	const fixture = await findLatestTournamentFixture(context);
	if (phase === "paused") {
		if (fixture.tournament.status !== TournamentStatuses.REGISTRATION && fixture.tournament.status !== TournamentStatuses.COMBAT) {
			await setTournamentPhase(fixture.tournament, "registration");
		}
		await pauseTournament(fixture.tournament.id);
		return await loadFixture(fixture.tournament);
	}
	if (phase === "resume") {
		await resumeTournament(fixture.tournament.id, context);
		return await loadFixture(fixture.tournament);
	}
	if (phase === "cancelled") {
		await cancelTournament({
			tournamentId: fixture.tournament.id,
			discordGuildId: context.frontEndSubOrigin,
			reason: "test",
			isGuildAdministrator: context.discord?.isGuildAdministrator === true
		});
		return await loadFixture(fixture.tournament);
	}
	await setTournamentPhase(fixture.tournament, phase);
	if (phase === "completed") {
		await processDueTournaments();
	}
	return await loadFixture(fixture.tournament);
}

async function setTournamentPhase(tournament: Tournament, phase: Exclude<TournamentTestPhase, "paused" | "resume" | "cancelled">): Promise<void> {
	await Tournament.withLocked(tournament.id, async lockedTournament => {
		const now = Date.now();
		lockedTournament.status = TournamentStatuses[phase.toUpperCase() as keyof typeof TournamentStatuses];
		lockedTournament.registrationEndsAt = new Date(phase === "registration" ? now + TEST_PHASE_DURATION_MS : now - TEST_PHASE_DURATION_MS);
		lockedTournament.combatEndsAt = new Date(phase === "completed" ? now - 1 : now + TEST_PHASE_DURATION_MS);
		lockedTournament.pausedFromStatus = null;
		lockedTournament.pausedRemainingMs = null;
		lockedTournament.startedNotificationSent = phase !== "registration";
		lockedTournament.endingNotificationSent = phase === "completed";
		lockedTournament.endedNotificationSent = phase === "completed";
		await lockedTournament.save();
	});
	await TournamentParticipant.update({
		startedNotificationSent: phase !== "registration",
		endingNotificationSent: phase === "completed",
		endedNotificationSent: phase === "completed"
	}, { where: { tournamentId: tournament.id } });
}

export async function runTournamentTestFight(context: PacketContext, player: Player): Promise<string> {
	const fixture = await forceTournamentPhase(context, "combat");
	const attacker = fixture.participants.find(participant => participant.playerId === player.id) ?? fixture.participants[0];
	const defender = fixture.participants.find(participant => participant.category === attacker.category && participant.id !== attacker.id);
	if (!defender) {
		throw new Error("Aucun adversaire de la même catégorie");
	}
	const fightInitiator = {};
	const fight = {
		id: `${TEST_PLAYER_PREFIX}fight-${Date.now()}`,
		isBugged: (): boolean => false,
		tournamentContext: {
			tournamentId: fixture.tournament.id,
			attackerParticipantId: attacker.id,
			defenderParticipantId: defender.id,
			category: attacker.category
		},
		fightInitiator,
		isADraw: (): boolean => false,
		getWinnerFighter: (): object => fightInitiator
	} as never;
	const response: CrowniclesPacket[] = [];
	await resolveTournamentFight(fight, response);
	const first = await TournamentParticipant.findByPk(attacker.id);
	await resolveTournamentFight(fight, response);
	const second = await TournamentParticipant.findByPk(attacker.id);
	return `Fight ${attacker.id}/${defender.id} : ${response.length} paquet(s), combat(s) persisté(s)=${await TournamentFight.count({ where: { tournamentId: fixture.tournament.id } })}, attaque ${first?.attackGloryPoints} -> ${second?.attackGloryPoints}`;
}

export async function finishTournamentFixture(context: PacketContext): Promise<TournamentTestFixture> {
	const fixture = await forceTournamentPhase(context, "combat");
	await Tournament.withLocked(fixture.tournament.id, async lockedTournament => {
		lockedTournament.combatEndsAt = new Date(Date.now() - 1);
		await lockedTournament.save();
	});
	await processDueTournaments();
	return await loadFixture(fixture.tournament);
}

export async function claimTournamentFixture(context: PacketContext, player: Player, claimAll: boolean, retry: boolean): Promise<string> {
	const fixture = await findLatestTournamentFixture(context);
	const players = claimAll ? fixture.players : [player];
	let itemPackets = 0;
	for (const fixturePlayer of players) {
		const response: CrowniclesPacket[] = [];
		await claimTournamentReward(getPlayerContext(context, fixturePlayer.keycloakId), response, fixturePlayer);
		itemPackets += response.filter(packet => packet instanceof ItemFoundPacket).length;
	}
	let retryPackets = 0;
	if (retry) {
		const response: CrowniclesPacket[] = [];
		await claimTournamentReward(context, response, player);
		retryPackets = response.length;
	}
	const claimed = await TournamentParticipant.count({
		where: {
			tournamentId: fixture.tournament.id,
			rewardGrantedAt: { [Op.not]: null }
		}
	});
	const completed = await Tournament.findByPk(fixture.tournament.id);
	return `Récompenses : ${claimed}/${fixture.participants.length} claims, ${itemPackets} objet(s), nouvelle tentative=${retryPackets}, distributed=${completed?.rewardsDistributed}`;
}
