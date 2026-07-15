import {
	afterAll, beforeAll, beforeEach, describe, expect, it
} from "vitest";
import type { ModelStatic } from "sequelize";
import {
	CoreTestEnvironment, loadProductionModule, runAllOrThrow, setupCoreForTests
} from "../_coreSetup";
import type { Player as PlayerType } from "../../src/core/database/game/models/Player";
import type { Guild as GuildType } from "../../src/core/database/game/models/Guild";
import type { PetEntity as PetEntityType } from "../../src/core/database/game/models/PetEntity";
import type { PetExpedition as PetExpeditionType } from "../../src/core/database/game/models/PetExpedition";
import type { PlayerTalismans as PlayerTalismansType } from "../../src/core/database/game/models/PlayerTalismans";
import type { ScheduledExpeditionNotification as ScheduledExpeditionNotificationType } from "../../src/core/database/game/models/ScheduledExpeditionNotification";
import { ExpeditionConstants } from "../../../Lib/src/constants/ExpeditionConstants";
import type { ExpeditionData } from "../../../Lib/src/packets/commands/CommandPetExpeditionPacket";

type ExpeditionActionHandlersModule = typeof import("../../src/core/expeditions/ExpeditionActionHandlers");
type PendingExpeditionsCacheModule = typeof import("../../src/core/expeditions/PendingExpeditionsCache");

const FOOD_PER_EXPEDITION = 3;

describe("pet expedition races", () => {
	let env: CoreTestEnvironment;
	let Player: ModelStatic<PlayerType>;
	let Guild: ModelStatic<GuildType>;
	let PetEntity: ModelStatic<PetEntityType>;
	let PetExpedition: ModelStatic<PetExpeditionType>;
	let PlayerTalismans: ModelStatic<PlayerTalismansType>;
	let ScheduledExpeditionNotification: ModelStatic<ScheduledExpeditionNotificationType>;
	let handlers: ExpeditionActionHandlersModule;
	let pendingCache: PendingExpeditionsCacheModule["PendingExpeditionsCache"];

	beforeAll(async () => {
		env = await setupCoreForTests("petexpeditionrace");
		const models = env.crownicles.gameDatabase.sequelize.models;
		Player = models.Player as ModelStatic<PlayerType>;
		Guild = models.Guild as ModelStatic<GuildType>;
		PetEntity = models.PetEntity as ModelStatic<PetEntityType>;
		PetExpedition = models.PetExpedition as ModelStatic<PetExpeditionType>;
		PlayerTalismans = models.PlayerTalismans as ModelStatic<PlayerTalismansType>;
		ScheduledExpeditionNotification = models.ScheduledExpeditionNotification as ModelStatic<ScheduledExpeditionNotificationType>;
		handlers = loadProductionModule<ExpeditionActionHandlersModule>("core/expeditions/ExpeditionActionHandlers");
		pendingCache = loadProductionModule<PendingExpeditionsCacheModule>(
			"core/expeditions/PendingExpeditionsCache"
		).PendingExpeditionsCache;
	});

	afterAll(async () => {
		await env?.teardown();
	});

	beforeEach(async () => {
		await env.crownicles.gameDatabase.sequelize.query("SET FOREIGN_KEY_CHECKS = 0");
		try {
			await ScheduledExpeditionNotification.destroy({ truncate: true, force: true });
			await PetExpedition.destroy({ truncate: true, force: true });
			await PlayerTalismans.destroy({ truncate: true, force: true });
			await PetEntity.destroy({ truncate: true, force: true });
			await Player.destroy({ truncate: true, force: true });
			await Guild.destroy({ truncate: true, force: true });
		}
		finally {
			await env.crownicles.gameDatabase.sequelize.query("SET FOREIGN_KEY_CHECKS = 1");
		}
	});

	function expedition(id: string): ExpeditionData {
		return {
			id,
			durationMinutes: 60,
			displayDurationMinutes: 60,
			riskRate: 10,
			difficulty: 10,
			wealthRate: 1,
			locationType: ExpeditionConstants.EXPEDITION_LOCATION_TYPES.FOREST,
			foodCost: FOOD_PER_EXPEDITION,
			mapLocationId: 1
		};
	}

	async function seedPlayer(keycloakId: string, guildId: number): Promise<{ player: PlayerType; pet: PetEntityType }> {
		const pet = await PetEntity.create({
			typeId: 1,
			sex: "m",
			nickname: keycloakId.slice(0, 16),
			lovePoints: 50
		});
		const player = await Player.create({
			keycloakId,
			guildId,
			petId: pet.id
		});
		await PlayerTalismans.create({
			playerId: player.id,
			hasTalisman: true
		});
		return {
			player, pet
		};
	}

	it("creates one active expedition when two selections race", async () => {
		const guild = await Guild.create({
			name: "ExpeditionRaceGuild",
			chiefId: 1,
			commonFood: FOOD_PER_EXPEDITION * 2
		});
		const {
			player, pet
		} = await seedPlayer("expedition-double-start", guild.id);
		const option = expedition("double-start");
		pendingCache.set(player.keycloakId, [option]);

		const responses = [[], []];
		await runAllOrThrow(responses.map(response => handlers.handleExpeditionSelect({
			player,
			petEntity: pet,
			expeditionId: option.id,
			keycloakId: player.keycloakId
		}, response)));

		expect(await PetExpedition.count({ where: { playerId: player.id } })).toBe(1);
		const freshGuild = await Guild.findByPk(guild.id);
		expect(freshGuild!.commonFood).toBe(FOOD_PER_EXPEDITION);
	});

	it("preserves every guild food debit when two members start concurrently", async () => {
		const initialFood = FOOD_PER_EXPEDITION * 2;
		const guild = await Guild.create({
			name: "ExpeditionFoodRaceGuild",
			chiefId: 1,
			commonFood: initialFood
		});
		const members = await Promise.all([
			seedPlayer("expedition-food-a", guild.id),
			seedPlayer("expedition-food-b", guild.id)
		]);

		await runAllOrThrow(members.map(async ({ player, pet }, index) => {
			const option = expedition(`food-${index}`);
			pendingCache.set(player.keycloakId, [option]);
			await handlers.handleExpeditionSelect({
				player,
				petEntity: pet,
				expeditionId: option.id,
				keycloakId: player.keycloakId
			}, []);
		}));

		const freshGuild = await Guild.findByPk(guild.id);
		expect(freshGuild!.commonFood).toBe(0);
		expect(await PetExpedition.count()).toBe(2);
	});

	it("rejects a stale recall after the expedition end date", async () => {
		const guild = await Guild.create({
			name: "ExpiredRecallGuild", chiefId: 1
		});
		const {
			player, pet
		} = await seedPlayer("expedition-expired-recall", guild.id);
		const activeExpedition = await PetExpedition.create({
			playerId: player.id,
			petId: pet.id,
			startDate: new Date(Date.now() - 120_000),
			endDate: new Date(Date.now() - 60_000),
			riskRate: 10,
			difficulty: 10,
			wealthRate: 1,
			locationType: ExpeditionConstants.EXPEDITION_LOCATION_TYPES.FOREST,
			mapLocationId: 1,
			status: ExpeditionConstants.STATUS.IN_PROGRESS,
			foodConsumed: 0,
			rewardIndex: 0
		});

		const response = [];
		await handlers.handleExpeditionRecall(player, response);

		expect(await PetExpedition.findByPk(activeExpedition.id)).toBeTruthy();
		const freshPet = await PetEntity.findByPk(pet.id);
		expect(freshPet!.lovePoints).toBe(50);
	});
});