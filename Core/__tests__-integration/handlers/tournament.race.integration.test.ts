import {
	afterAll, beforeAll, beforeEach, describe, expect, it, vi
} from "vitest";
import type { ModelStatic } from "sequelize";
import {
	CoreTestEnvironment, loadProductionModule, setupCoreForTests
} from "../_coreSetup";
import type PlayerType from "../../src/core/database/game/models/Player";
import type TournamentType from "../../src/core/database/game/models/Tournament";
import type TournamentCodeType from "../../src/core/database/game/models/TournamentCode";
import type TournamentParticipantType from "../../src/core/database/game/models/TournamentParticipant";
import type TournamentFightType from "../../src/core/database/game/models/TournamentFight";
import type PlayerBadgesType from "../../src/core/database/game/models/PlayerBadges";
import type { CrowniclesPacket, PacketContext } from "../../../Lib/src/packets/CrowniclesPacket";
import {
	TournamentCategories, TournamentLevelLimitMode, TournamentLevelLimitModes, TournamentStatuses
} from "../../../Lib/src/types/Tournament";
import { TournamentErrorCodes } from "../../../Lib/src/packets/commands/CommandTournamentPacket";
import { ItemCategory, ItemRarity } from "../../../Lib/src/constants/ItemConstants";
import { TournamentConstants } from "../../../Lib/src/constants/TournamentConstants";
import { ItemFoundPacket } from "../../../Lib/src/packets/events/ItemFoundPacket";
import type { InventoryInfo as InventoryInfoType } from "../../src/core/database/game/models/InventoryInfo";
import type { InventorySlot as InventorySlotType } from "../../src/core/database/game/models/InventorySlot";

type TournamentCreationModule = typeof import("../../src/core/tournaments/TournamentCreation");
type TournamentRegistrationModule = typeof import("../../src/core/tournaments/TournamentRegistration");
type TournamentQueriesModule = typeof import("../../src/core/tournaments/TournamentQueries");
type TournamentMatchmakingModule = typeof import("../../src/core/tournaments/TournamentMatchmaking");
type TournamentPauseModule = typeof import("../../src/core/tournaments/TournamentPause");
type TournamentLifecycleModule = typeof import("../../src/core/tournaments/TournamentLifecycle");
type TournamentRankingModule = typeof import("../../src/core/tournaments/TournamentRanking");
type TournamentRewardsModule = typeof import("../../src/core/tournaments/TournamentRewards");
type TournamentFightResolverModule = typeof import("../../src/core/tournaments/TournamentFightResolver");
type PacketUtilsModule = typeof import("../../src/core/utils/PacketUtils");
type EloUtilsModule = typeof import("../../src/core/utils/EloUtils");
type InventoryInfoModule = typeof import("../../src/core/database/game/models/InventoryInfo");
type InventorySlotsModule = typeof import("../../src/core/database/game/models/InventorySlot");

type TournamentLevelOptions = {
	levelLimitMode?: TournamentLevelLimitMode;
	levelCap?: number;
};

type TournamentTestApi = {
	generateCode: (discordGuildId: string) => ReturnType<TournamentCreationModule["generateTournamentCode"]>;
	createTournament: (
		context: PacketContext,
		code: string,
		registrationDays: number,
		combatDays: number,
		levelOptions?: TournamentLevelOptions
	) => ReturnType<TournamentCreationModule["createTournament"]>;
	registerPlayer: TournamentRegistrationModule["registerPlayer"];
	findTournamentForContext: TournamentQueriesModule["findTournamentForContext"];
	getParticipant: TournamentQueriesModule["getParticipant"];
	findOpponent: TournamentMatchmakingModule["findOpponent"];
	pauseTournament: TournamentPauseModule["pauseTournament"];
	resumeTournament: TournamentPauseModule["resumeTournament"];
	getStatusData: TournamentRankingModule["getStatusData"];
	getTopData: TournamentRankingModule["getTopData"];
	claimTournamentReward: TournamentRewardsModule["claimTournamentReward"];
	processDueTournaments: TournamentLifecycleModule["processDueTournaments"];
	resolveFight: TournamentFightResolverModule["resolveTournamentFight"];
};

const GUILD_ID = "tournament-race-guild";
const CHANNEL_ID = "tournament-race-channel";

function buildContext(keycloakId: string): PacketContext {
	return {
		frontEndOrigin: "discord",
		frontEndSubOrigin: GUILD_ID,
		keycloakId,
		discord: {
			user: keycloakId,
			interaction: `interaction-${keycloakId}`,
			channel: CHANNEL_ID,
			language: "fr",
				shardId: 0,
				guildMemberCount: 1000,
				isGuildAdministrator: true,
				isBotOwner: true
		}
	};
}

describe("Tournament modules integration", () => {
	let env: CoreTestEnvironment;
	let manager: TournamentTestApi;
	let eloUtils: EloUtilsModule["EloUtils"];
	let packetUtils: PacketUtilsModule["PacketUtils"];
	let Player: ModelStatic<PlayerType>;
	let Tournament: ModelStatic<TournamentType>;
	let TournamentCode: ModelStatic<TournamentCodeType>;
	let TournamentParticipant: ModelStatic<TournamentParticipantType>;
	let TournamentFight: ModelStatic<TournamentFightType>;
	let PlayerBadges: ModelStatic<PlayerBadgesType>;
	let InventoryInfo: ModelStatic<InventoryInfoType>;
	let InventorySlot: ModelStatic<InventorySlotType>;
	let inventorySlots: InventorySlotsModule["InventorySlots"];

	beforeAll(async () => {
		env = await setupCoreForTests("tournament");
		const creation = loadProductionModule<TournamentCreationModule>("core/tournaments/TournamentCreation");
		const registration = loadProductionModule<TournamentRegistrationModule>("core/tournaments/TournamentRegistration");
		const queries = loadProductionModule<TournamentQueriesModule>("core/tournaments/TournamentQueries");
		const matchmaking = loadProductionModule<TournamentMatchmakingModule>("core/tournaments/TournamentMatchmaking");
		const pause = loadProductionModule<TournamentPauseModule>("core/tournaments/TournamentPause");
		const lifecycle = loadProductionModule<TournamentLifecycleModule>("core/tournaments/TournamentLifecycle");
		const ranking = loadProductionModule<TournamentRankingModule>("core/tournaments/TournamentRanking");
		const fightResolver = loadProductionModule<TournamentFightResolverModule>("core/tournaments/TournamentFightResolver");
		manager = {
			generateCode: discordGuildId => creation.generateTournamentCode(discordGuildId),
			createTournament: (context, code, registrationDays, combatDays, levelOptions) => creation.createTournament({
				context,
				code,
				duration: { registrationDays, combatDays },
				...(levelOptions ?? {})
			}),
			registerPlayer: registration.registerPlayer,
			findTournamentForContext: queries.findTournamentForContext,
			getParticipant: queries.getParticipant,
			findOpponent: matchmaking.findOpponent,
			pauseTournament: pause.pauseTournament,
			resumeTournament: pause.resumeTournament,
			getStatusData: ranking.getStatusData,
			getTopData: ranking.getTopData,
			claimTournamentReward: loadProductionModule<TournamentRewardsModule>("core/tournaments/TournamentRewards").claimTournamentReward,
			processDueTournaments: lifecycle.processDueTournaments,
			resolveFight: fightResolver.resolveTournamentFight
		};
		eloUtils = loadProductionModule<EloUtilsModule>("core/utils/EloUtils").EloUtils;
		packetUtils = loadProductionModule<PacketUtilsModule>("core/utils/PacketUtils").PacketUtils;
		Player = env.crownicles.gameDatabase.sequelize.models.Player as ModelStatic<PlayerType>;
		Tournament = env.crownicles.gameDatabase.sequelize.models.Tournament as ModelStatic<TournamentType>;
		TournamentCode = env.crownicles.gameDatabase.sequelize.models.TournamentCode as ModelStatic<TournamentCodeType>;
		TournamentParticipant = env.crownicles.gameDatabase.sequelize.models.TournamentParticipant as ModelStatic<TournamentParticipantType>;
		TournamentFight = env.crownicles.gameDatabase.sequelize.models.TournamentFight as ModelStatic<TournamentFightType>;
		PlayerBadges = env.crownicles.gameDatabase.sequelize.models.PlayerBadges as ModelStatic<PlayerBadgesType>;
		const inventoryInfoModule = loadProductionModule<InventoryInfoModule>("core/database/game/models/InventoryInfo");
		InventoryInfo = inventoryInfoModule.InventoryInfo as ModelStatic<InventoryInfoType>;
		const inventoryModule = loadProductionModule<InventorySlotsModule>("core/database/game/models/InventorySlot");
		InventorySlot = inventoryModule.InventorySlot as ModelStatic<InventorySlotType>;
		inventorySlots = inventoryModule.InventorySlots;
	});

	afterAll(async () => {
		await env?.teardown();
	});

	beforeEach(async () => {
		await env.crownicles.gameDatabase.sequelize.query("SET FOREIGN_KEY_CHECKS = 0");
		try {
			await TournamentFight.destroy({ truncate: true, force: true });
			await TournamentParticipant.destroy({ truncate: true, force: true });
			await Tournament.destroy({ truncate: true, force: true });
			await TournamentCode.destroy({ truncate: true, force: true });
			await PlayerBadges.destroy({ truncate: true, force: true });
			await InventorySlot.destroy({ truncate: true, force: true });
			await InventoryInfo.destroy({ truncate: true, force: true });
			await Player.destroy({ truncate: true, force: true });
		}
		finally {
			await env.crownicles.gameDatabase.sequelize.query("SET FOREIGN_KEY_CHECKS = 1");
		}
	});

	it("allows only one concurrent registration for the same player", async () => {
		const owner = await Player.create({
			keycloakId: "tournament-owner",
			level: 50
		});
		const code = await manager.generateCode(GUILD_ID);
		await manager.createTournament(buildContext(owner.keycloakId), code.code, 1, 1);
		const player = await Player.create({
			keycloakId: "tournament-racer",
			level: 50
		});

		const results = await Promise.allSettled([
			manager.registerPlayer(buildContext(player.keycloakId), player),
			manager.registerPlayer(buildContext(player.keycloakId), player)
		]);

		expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
		expect(results.filter(result => result.status === "rejected")).toHaveLength(1);
		expect(await TournamentParticipant.count()).toBe(1);
	});

	it("starts combat only with 20 participants and 10 in each category", async () => {
		const owner = await Player.create({
			keycloakId: "tournament-owner-threshold",
			level: 50
		});
		const code = await manager.generateCode(GUILD_ID);
		const tournament = await manager.createTournament(buildContext(owner.keycloakId), code.code, 1, 1);
		const players = await Promise.all(Array.from({ length: 20 }, (_, index) => Player.create({
			keycloakId: `tournament-threshold-${index}`,
			level: index < 10 ? 50 : 100
		})));
		await Promise.all(players.map(player => manager.registerPlayer(buildContext(player.keycloakId), player)));
		await Tournament.update({ registrationEndsAt: new Date(Date.now() - 1) }, { where: { id: tournament.id } });

		const sendNotifications = vi.spyOn(packetUtils, "sendNotifications").mockImplementation(() => undefined);
		await manager.processDueTournaments();

		const started = await Tournament.findByPk(tournament.id);
		const startedParticipants = await TournamentParticipant.findAll({ where: { tournamentId: tournament.id } });
		expect(started?.status).toBe(TournamentStatuses.COMBAT);
		expect(startedParticipants.every(participant => participant.startedNotificationSent)).toBe(true);
		expect(sendNotifications).toHaveBeenCalledOnce();
		expect(sendNotifications.mock.calls[0][0]).toHaveLength(20);
		const top = await manager.getTopData(buildContext(players[0].keycloakId), players[0], 1);
		expect(top.categories).toHaveLength(2);
		expect(top.categories.every(category => category.totalParticipants === 10)).toBe(true);
		expect(top.categories.every(category => category.elements.length === 10)).toBe(true);
		expect(top.pageNumber).toBe(1);
		expect(top.totalPages).toBe(1);
		sendNotifications.mockRestore();
	});

	it("shows the guild tournament status from any channel", async () => {
		const owner = await Player.create({
			keycloakId: "tournament-owner-status",
			level: 100
		});
		const code = await manager.generateCode(GUILD_ID);
		await manager.createTournament(buildContext(owner.keycloakId), code.code, 1, 1);
		const player = await Player.create({
			keycloakId: "tournament-status-player",
			level: 100
		});
		await manager.registerPlayer(buildContext(player.keycloakId), player);
		const statusContext = buildContext(player.keycloakId);
		statusContext.discord!.channel = "unrelated-channel";

		const status = await manager.getStatusData(statusContext, player);

		expect(status.discordGuildId).toBe(GUILD_ID);
		expect(status.discordChannelId).toBe(CHANNEL_ID);
		expect(status.status).toBe(TournamentStatuses.REGISTRATION);
		expect(status.levelLimitMode).toBe(TournamentLevelLimitModes.CATEGORY);
		expect(status.levelCap).toBeNull();
		expect(status.participantCount).toBe(1);
		expect(status.categoryCounts[TournamentCategories.LEVEL_100]).toBe(1);
		expect(status.category).toBe(TournamentCategories.LEVEL_100);
		expect(status.rank).toBe(1);
		expect(status.reward).toBeUndefined();
	});

	it("prefers the active tournament in the current channel over a newer finished one", async () => {
		const owner = await Player.create({
			keycloakId: "tournament-owner-context-priority",
			level: 100
		});
		const activeCode = await manager.generateCode(GUILD_ID);
		const activeTournament = await manager.createTournament(buildContext(owner.keycloakId), activeCode.code, 1, 1);

		const finishedContext = buildContext(owner.keycloakId);
		const finishedCode = await manager.generateCode(GUILD_ID);
		const finishedTournament = await manager.createTournament(finishedContext, finishedCode.code, 1, 1);
		await Tournament.update({ status: TournamentStatuses.COMPLETED }, { where: { id: finishedTournament.id } });

		const player = await Player.create({
			keycloakId: "tournament-context-priority-player",
			level: 100
		});
		const status = await manager.getStatusData(buildContext(player.keycloakId), player);

		expect(status.tournamentId).toBe(activeTournament.id);
		expect(status.status).toBe(TournamentStatuses.REGISTRATION);
	});

	it("persists custom level limits and rejects players above the limit", async () => {
		const owner = await Player.create({
			keycloakId: "tournament-owner-level-limit",
			level: 100
		});
		const capCode = await manager.generateCode(GUILD_ID);
		const cappedTournament = await manager.createTournament(
			buildContext(owner.keycloakId),
			capCode.code,
			1,
			1,
			{
				levelLimitMode: TournamentLevelLimitModes.CAP,
				levelCap: 20
			}
		);
		const cappedPlayer = await Player.create({
			keycloakId: "tournament-capped-player",
			level: 100
		});
		await manager.registerPlayer(buildContext(cappedPlayer.keycloakId), cappedPlayer);

		const persistedCappedTournament = await Tournament.findByPk(cappedTournament.id);
		const cappedTop = await manager.getTopData(buildContext(cappedPlayer.keycloakId), cappedPlayer, 1);
		expect(persistedCappedTournament?.levelLimitMode).toBe(TournamentLevelLimitModes.CAP);
		expect(persistedCappedTournament?.levelCap).toBe(20);
		expect(cappedTop.categories.find(category => category.category === TournamentCategories.LEVEL_100)?.elements[0].effectiveLevel).toBe(20);

		const rejectCode = await manager.generateCode(GUILD_ID);
		await manager.createTournament(
			buildContext(owner.keycloakId),
			rejectCode.code,
			1,
			1,
			{
				levelLimitMode: TournamentLevelLimitModes.REJECT,
				levelCap: 20
			}
		);
		const rejectedPlayer = await Player.create({
			keycloakId: "tournament-rejected-player",
			level: 21
		});

		await expect(manager.registerPlayer(buildContext(rejectedPlayer.keycloakId), rejectedPlayer))
			.rejects.toMatchObject({ code: TournamentErrorCodes.LEVEL_TOO_HIGH });

		const invalidCode = await manager.generateCode(GUILD_ID);
		await expect(manager.createTournament(
			buildContext(owner.keycloakId),
			invalidCode.code,
			1,
			1,
			{
				levelLimitMode: TournamentLevelLimitModes.CAP,
				levelCap: TournamentConstants.MAX_LEVEL_CAP + 1
			}
		)).rejects.toMatchObject({ code: TournamentErrorCodes.INVALID_LEVEL_LIMIT });
	});

	it("assigns a late registration 750 attack and zero defense glory", async () => {
		const owner = await Player.create({
			keycloakId: "tournament-owner-late",
			level: 100
		});
		const code = await manager.generateCode(GUILD_ID);
		const tournament = await manager.createTournament(buildContext(owner.keycloakId), code.code, 1, 1);
		await Tournament.update({ status: TournamentStatuses.COMBAT }, { where: { id: tournament.id } });
		const player = await Player.create({
			keycloakId: "tournament-late-player",
			level: 100
		});

		const participant = await manager.registerPlayer(buildContext(player.keycloakId), player);

		expect(participant.category).toBe(TournamentCategories.LEVEL_100);
		expect(participant.attackGloryPoints).toBe(750);
		expect(participant.defenseGloryPoints).toBe(0);
		expect(participant.lateRegistration).toBe(true);
	});

	it("rejects registration after the tournament has been completed", async () => {
		const owner = await Player.create({
			keycloakId: "tournament-owner-completed-registration",
			level: 100
		});
		const code = await manager.generateCode(GUILD_ID);
		const tournament = await manager.createTournament(buildContext(owner.keycloakId), code.code, 1, 1);
		await Tournament.update({ status: TournamentStatuses.COMPLETED }, { where: { id: tournament.id } });
		const player = await Player.create({
			keycloakId: "tournament-completed-registration",
			level: 100
		});

		await expect(manager.registerPlayer(buildContext(player.keycloakId), player)).rejects.toMatchObject({
			code: TournamentErrorCodes.NOT_FOUND
		});
		expect(await TournamentParticipant.count({ where: { tournamentId: tournament.id } })).toBe(0);
	});

	it("matches a distant opponent from the same category without a glory gap cap", async () => {
		const owner = await Player.create({
			keycloakId: "tournament-owner-matchmaking",
			level: 100
		});
		const code = await manager.generateCode(GUILD_ID);
		const tournament = await manager.createTournament(buildContext(owner.keycloakId), code.code, 1, 1);
		await Tournament.update({ status: TournamentStatuses.COMBAT }, { where: { id: tournament.id } });
		const attacker = await Player.create({
			keycloakId: "tournament-attacker-matchmaking",
			level: 100
		});
		const distantOpponent = await Player.create({
			keycloakId: "tournament-distant-opponent",
			level: 100
		});
		const attackerParticipant = await manager.registerPlayer(buildContext(attacker.keycloakId), attacker);
		const opponentParticipant = await manager.registerPlayer(buildContext(distantOpponent.keycloakId), distantOpponent);
		await TournamentParticipant.update({
			attackGloryPoints: 4000,
			defenseGloryPoints: 4000
		}, {
			where: { id: attackerParticipant.id }
		});
		await TournamentParticipant.update({
			attackGloryPoints: 0,
			defenseGloryPoints: 0
		}, {
			where: { id: opponentParticipant.id }
		});

		const selected = await manager.findOpponent(tournament, await TournamentParticipant.findByPk(attackerParticipant.id) as TournamentParticipantType);

		expect(selected?.id).toBe(opponentParticipant.id);
	});

	it("pauses and resumes with the same phase and a frozen remaining duration", async () => {
		const owner = await Player.create({
			keycloakId: "tournament-owner-pause",
			level: 100
		});
		const code = await manager.generateCode(GUILD_ID);
		const tournament = await manager.createTournament(buildContext(owner.keycloakId), code.code, 1, 1);
		await Tournament.update({
			registrationEndsAt: new Date(Date.now() + 120_000),
			combatEndsAt: new Date(Date.now() + 240_000)
		}, {
			where: { id: tournament.id }
		});

		await manager.pauseTournament(tournament.id);
		const paused = await Tournament.findByPk(tournament.id);
		expect(paused?.status).toBe(TournamentStatuses.PAUSED);
		expect(paused?.pausedFromStatus).toBe(TournamentStatuses.REGISTRATION);
		expect(paused?.pausedRemainingMs).toBeGreaterThan(0);

		await manager.resumeTournament(tournament.id, buildContext(owner.keycloakId));
		const resumed = await Tournament.findByPk(tournament.id);
		expect(resumed?.status).toBe(TournamentStatuses.REGISTRATION);
		expect(resumed?.pausedRemainingMs).toBeNull();
		expect(resumed?.discordChannelId).toBe(CHANNEL_ID);
	});

	it("resolves the same fight only once", async () => {
		const owner = await Player.create({
			keycloakId: "tournament-owner-idempotence",
			level: 100
		});
		const code = await manager.generateCode(GUILD_ID);
		const tournament = await manager.createTournament(buildContext(owner.keycloakId), code.code, 1, 1);
		await Tournament.update({ status: TournamentStatuses.COMBAT }, { where: { id: tournament.id } });
		const attacker = await Player.create({
			keycloakId: "tournament-attacker-idempotence",
			level: 100
		});
		const defender = await Player.create({
			keycloakId: "tournament-defender-idempotence",
			level: 100
		});
		const attackerParticipant = await manager.registerPlayer(buildContext(attacker.keycloakId), attacker);
		const defenderParticipant = await manager.registerPlayer(buildContext(defender.keycloakId), defender);
		await TournamentParticipant.update({ defenseGloryPoints: 750 }, { where: { id: defenderParticipant.id } });
		defenderParticipant.defenseGloryPoints = 750;
		const expectedDefenderDefense = eloUtils.calculateNewRating(
			defenderParticipant.defenseGloryPoints,
			attackerParticipant.attackGloryPoints,
			0,
			eloUtils.getKFactorFromGlory(defenderParticipant.getTotalGloryPoints())
		);
		const fightInitiator = {};
		const fakeFight = {
			id: "tournament-fight-idempotence",
			isBugged: (): boolean => false,
			tournamentContext: {
				tournamentId: tournament.id,
				attackerParticipantId: attackerParticipant.id,
				defenderParticipantId: defenderParticipant.id,
				category: TournamentCategories.LEVEL_100
			},
			fightInitiator,
			isADraw: (): boolean => false,
			getWinnerFighter: (): object => fightInitiator
		} as never;

		await manager.resolveFight(fakeFight, []);
		const afterFirstResolution = await TournamentParticipant.findByPk(attackerParticipant.id);
		const afterFirstDefenderResolution = await TournamentParticipant.findByPk(defenderParticipant.id);
		await manager.resolveFight(fakeFight, []);
		const afterSecondResolution = await TournamentParticipant.findByPk(attackerParticipant.id);

		expect(await TournamentFight.count()).toBe(1);
		expect(afterSecondResolution?.attackGloryPoints).toBe(afterFirstResolution?.attackGloryPoints);
		expect(afterFirstDefenderResolution?.defenseGloryPoints).toBe(expectedDefenderDefense);
	});

	it("freezes the two category rankings and grants final rewards once", async () => {
		const owner = await Player.create({
			keycloakId: "tournament-owner-finish",
			level: 100
		});
		const code = await manager.generateCode(GUILD_ID);
		const tournament = await manager.createTournament(buildContext(owner.keycloakId), code.code, 1, 1);
		const players = await Promise.all(Array.from({ length: 20 }, (_, index) => Player.create({
			keycloakId: `tournament-finish-${index}`,
			level: index < 10 ? 50 : 100
		})));
		await Promise.all(players.map(player => InventoryInfo.create({
			playerId: player.id,
			weaponSlots: 3,
			armorSlots: 3,
			potionSlots: 3,
			objectSlots: 3
		})));
		const participants = await Promise.all(players.map(player => manager.registerPlayer(buildContext(player.keycloakId), player)));
		await Promise.all(participants
			.filter(participant => participant.category === TournamentCategories.LEVEL_100)
			.map(participant => TournamentParticipant.update({ normalLeagueId: 10 }, {
				where: { id: participant.id }
			})));
		await Tournament.update({ startedNotificationSent: true }, { where: { id: tournament.id } });
		await TournamentParticipant.update({ startedNotificationSent: true }, { where: { tournamentId: tournament.id } });
		await TournamentParticipant.update({
			attackGloryPoints: 1000,
			defenseGloryPoints: 1000
		}, {
			where: { id: participants[0].id }
		});
		await Tournament.update({
			status: TournamentStatuses.COMBAT,
			registrationEndsAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
			combatEndsAt: new Date(Date.now() - 24 * 60 * 60 * 1000)
		}, {
			where: { id: tournament.id }
		});

		const sendNotifications = vi.spyOn(packetUtils, "sendNotifications").mockImplementation(() => undefined);
		await manager.processDueTournaments();

		const finished = await Tournament.findByPk(tournament.id);
		const finishedParticipants = await TournamentParticipant.findAll({
			where: { tournamentId: tournament.id }
		});
		const winners = finishedParticipants.filter(participant => participant.isWinner);
		expect(finished?.status).toBe(TournamentStatuses.COMPLETED);
		expect(finished?.rewardsDistributed).toBe(false);
		expect(winners).toHaveLength(2);
		expect(finishedParticipants.every(participant => participant.finalRank !== null)).toBe(true);
		expect(finishedParticipants.every(participant => participant.rewardGrantedAt === null)).toBe(true);
		expect(finishedParticipants.every(participant => participant.endedNotificationSent)).toBe(true);
		const level100Ranking = finishedParticipants
			.filter(participant => participant.category === TournamentCategories.LEVEL_100)
			.sort((left, right) => (left.finalRank ?? 0) - (right.finalRank ?? 0));
		const firstRankFactor = TournamentConstants.RANK_REWARD_MAX_PERCENT / TournamentConstants.REWARD_PERCENTAGE_DIVISOR;
		const lastRankFactor = TournamentConstants.RANK_REWARD_MIN_PERCENT / TournamentConstants.REWARD_PERCENTAGE_DIVISOR;
		expect(level100Ranking[0].rewardXp).toBe(TournamentConstants.BASE_XP_REWARD * TournamentConstants.MINIMUM_REWARD_MULTIPLIER * firstRankFactor);
		expect(level100Ranking.at(-1)!.rewardXp).toBe(TournamentConstants.BASE_XP_REWARD * TournamentConstants.MINIMUM_REWARD_MULTIPLIER * lastRankFactor);
		expect(level100Ranking[0].rewardMoney).toBe(TournamentConstants.BASE_MONEY_REWARD * TournamentConstants.MINIMUM_REWARD_MULTIPLIER * firstRankFactor);
		expect(level100Ranking.at(-1)!.rewardMoney).toBe(TournamentConstants.BASE_MONEY_REWARD * TournamentConstants.MINIMUM_REWARD_MULTIPLIER * lastRankFactor);
		expect(level100Ranking[0].rewardXp).toBeGreaterThan(level100Ranking.at(-1)!.rewardXp);
		expect(level100Ranking[0].rewardMoney).toBeGreaterThan(level100Ranking.at(-1)!.rewardMoney);
		const level100Winner = winners.find(participant => participant.category === TournamentCategories.LEVEL_100)!;
		const winnerPlayer = players.find(player => player.id === level100Winner.playerId)!;
		const claimResponse: CrowniclesPacket[] = [];
		await manager.claimTournamentReward(buildContext(winnerPlayer.keycloakId), claimResponse, winnerPlayer);
		const finishedStatus = await manager.getStatusData(buildContext(winnerPlayer.keycloakId), winnerPlayer);
		const statusParticipant = finishedParticipants.find(participant => participant.playerId === winnerPlayer.id)!;
		expect(finishedStatus.rank).toBe(statusParticipant.finalRank);
		expect(finishedStatus.reward).toEqual({
			xp: statusParticipant.rewardXp,
			money: statusParticipant.rewardMoney,
			itemCount: statusParticipant.rewardItemCount,
			granted: true
		});
		expect(claimResponse.filter(packet => packet.constructor.name === "ItemFoundPacket")).toHaveLength(level100Winner.rewardItemCount);
		const claimedItem = claimResponse.find(packet => packet.constructor.name === ItemFoundPacket.name) as ItemFoundPacket;
		expect(claimedItem.itemWithDetails.itemCategory).not.toBe(ItemCategory.POTION);
		expect(claimedItem.itemWithDetails.rarity).toBeGreaterThanOrEqual(ItemRarity.LEGENDARY);
		expect((await Tournament.findByPk(tournament.id))?.rewardsDistributed).toBe(false);
		expect(await PlayerBadges.count()).toBe(1);
		expect(sendNotifications).toHaveBeenCalledTimes(2);
		for (const player of players) {
			await manager.claimTournamentReward(buildContext(player.keycloakId), [], player);
		}
		expect(await PlayerBadges.count()).toBe(2);
		expect((await Tournament.findByPk(tournament.id))?.rewardsDistributed).toBe(true);
		await manager.processDueTournaments();
		expect(sendNotifications).toHaveBeenCalledTimes(2);
		sendNotifications.mockRestore();
	});

	it("keeps rewards pending until a full inventory has room", async () => {
		const owner = await Player.create({
			keycloakId: "tournament-owner-inventory",
			level: 100
		});
		const code = await manager.generateCode(GUILD_ID);
		const tournament = await manager.createTournament(buildContext(owner.keycloakId), code.code, 1, 1);
		const players = await Promise.all(Array.from({ length: 20 }, (_, index) => Player.create({
			keycloakId: `tournament-inventory-${index}`,
			level: index < 10 ? 50 : 100
		})));
		const participants = await Promise.all(players.map(player => manager.registerPlayer(buildContext(player.keycloakId), player)));
		await Promise.all(players.map(player => InventoryInfo.upsert({
			playerId: player.id,
			weaponSlots: 3,
			armorSlots: 3,
			potionSlots: 3,
			objectSlots: 3,
			plantSlots: 1
		})));
		const fullPlayer = players[0];
		await inventorySlots.getOfPlayer(fullPlayer.id);
		await InventoryInfo.upsert({
			playerId: fullPlayer.id,
			weaponSlots: 1,
			armorSlots: 1,
			potionSlots: 1,
			objectSlots: 1,
			plantSlots: 1
		});
		await Promise.all([
			ItemCategory.WEAPON,
			ItemCategory.ARMOR,
			ItemCategory.POTION,
			ItemCategory.OBJECT
		].map(itemCategory => InventorySlot.update({ itemId: 1 }, {
			where: {
				playerId: fullPlayer.id,
				itemCategory,
				slot: 0
			}
		})));
		const initialExperience = fullPlayer.experience;
		const initialMoney = fullPlayer.money;
		await Tournament.update({
			status: TournamentStatuses.COMBAT,
			registrationEndsAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
			combatEndsAt: new Date(Date.now() - 24 * 60 * 60 * 1000)
		}, {
			where: { id: tournament.id }
		});

		const sendNotifications = vi.spyOn(packetUtils, "sendNotifications").mockImplementation(() => undefined);
		await manager.processDueTournaments();

		const pending = await TournamentParticipant.findByPk(participants[0].id);
		const unchangedPlayer = await Player.findByPk(fullPlayer.id);
		const pendingTournament = await Tournament.findByPk(tournament.id);
		expect(pending?.rewardGrantedAt).toBeNull();
		expect(unchangedPlayer?.experience).toBe(initialExperience);
		expect(unchangedPlayer?.money).toBe(initialMoney);
		expect(pendingTournament?.rewardsDistributed).toBe(false);

		await Promise.all([
			ItemCategory.WEAPON,
			ItemCategory.ARMOR,
			ItemCategory.POTION,
			ItemCategory.OBJECT
		].map(itemCategory => InventorySlot.update({ itemId: 0 }, {
			where: {
				playerId: fullPlayer.id,
				itemCategory,
				slot: 0
			}
		})));
		await InventoryInfo.upsert({
			playerId: fullPlayer.id,
			weaponSlots: 4,
			armorSlots: 4,
			potionSlots: 4,
			objectSlots: 4,
			plantSlots: 1
		});
		await manager.claimTournamentReward(buildContext(fullPlayer.keycloakId), [], fullPlayer);

		const granted = await TournamentParticipant.findByPk(participants[0].id);
		const completedTournament = await Tournament.findByPk(tournament.id);
		expect(granted?.rewardGrantedAt).not.toBeNull();
		expect(completedTournament?.rewardsDistributed).toBe(false);
		sendNotifications.mockRestore();
	});
});