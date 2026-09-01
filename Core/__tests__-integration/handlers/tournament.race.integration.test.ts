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
import type { PacketContext } from "../../../Lib/src/packets/CrowniclesPacket";
import {
	TournamentCategories, TournamentStatuses
} from "../../../Lib/src/types/Tournament";
import { ItemCategory } from "../../../Lib/src/constants/ItemConstants";
import type { InventoryInfo as InventoryInfoType } from "../../src/core/database/game/models/InventoryInfo";
import type { InventorySlot as InventorySlotType } from "../../src/core/database/game/models/InventorySlot";

type TournamentManagerModule = typeof import("../../src/core/tournaments/TournamentManager");
type PacketUtilsModule = typeof import("../../src/core/utils/PacketUtils");
type InventoryInfoModule = typeof import("../../src/core/database/game/models/InventoryInfo");
type InventorySlotsModule = typeof import("../../src/core/database/game/models/InventorySlot");

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

describe("TournamentManager integration", () => {
	let env: CoreTestEnvironment;
	let manager: TournamentManagerModule["TournamentManager"];
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
		manager = loadProductionModule<TournamentManagerModule>("core/tournaments/TournamentManager").TournamentManager;
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
		expect(started?.status).toBe(TournamentStatuses.COMBAT);
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
		await manager.resolveFight(fakeFight, []);
		const afterSecondResolution = await TournamentParticipant.findByPk(attackerParticipant.id);

		expect(await TournamentFight.count()).toBe(1);
		expect(afterSecondResolution?.attackGloryPoints).toBe(afterFirstResolution?.attackGloryPoints);
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
		expect(finished?.rewardsDistributed).toBe(true);
		expect(winners).toHaveLength(2);
		expect(finishedParticipants.every(participant => participant.finalRank !== null)).toBe(true);
		expect(finishedParticipants.every(participant => participant.rewardGrantedAt !== null)).toBe(true);
		expect(await PlayerBadges.count()).toBe(2);
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
		const fullPlayer = players[0];
		await inventorySlots.getOfPlayer(fullPlayer.id);
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
		await manager.processDueTournaments();

		const granted = await TournamentParticipant.findByPk(participants[0].id);
		const completedTournament = await Tournament.findByPk(tournament.id);
		expect(granted?.rewardGrantedAt).not.toBeNull();
		expect(completedTournament?.rewardsDistributed).toBe(true);
		sendNotifications.mockRestore();
	});
});