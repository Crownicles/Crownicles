import {afterAll, beforeAll, describe, expect, it, vi} from "vitest";
import type {ModelStatic} from "sequelize";
import {CoreTestEnvironment, loadProductionModule, pinInertDailyMission, runAllOrThrow, setupCoreForTests} from "../_coreSetup";
import type {Player as PlayerType} from "../../src/core/database/game/models/Player";
import type {InventorySlot as InventorySlotType} from "../../src/core/database/game/models/InventorySlot";
import {ItemCategory, ItemNature} from "../../../Lib/src/constants/ItemConstants";
import type {CrowniclesPacket, PacketContext} from "../../../Lib/src/packets/CrowniclesPacket";

type DrinkModule = typeof import("../../src/commands/player/DrinkCommand");
type CollectorsModule = typeof import("../../src/core/utils/ReactionsCollector");
type CollectorPacketsModule = typeof import("../../../Lib/src/packets/interaction/ReactionCollectorPacket");
type DrinkPacketsModule = typeof import("../../../Lib/src/packets/commands/CommandDrinkPacket");
type PotionModule = typeof import("../../src/data/Potion");

const N_CONCURRENT = 8;
const POTION_ID = 1;
const INITIAL_HEALTH = 1;
const MAP_LINK_ID = 1;
const KEYCLOAK_ID = "race-discord-app-drink";

describe("Discord/app potion consumption race", () => {
	let env: CoreTestEnvironment;
	let Player: ModelStatic<PlayerType>;
	let InventorySlot: ModelStatic<InventorySlotType>;
	let drinkModule: DrinkModule;
	let collectors: CollectorsModule;
	let collectorPackets: CollectorPacketsModule;
	let drinkPackets: DrinkPacketsModule;
	let potions: PotionModule;
	const createdAccounts = new Set<string>();

	beforeAll(async (): Promise<void> => {
		env = await setupCoreForTests("drinkrace");
		Player = env.crownicles.gameDatabase.sequelize.models.Player as ModelStatic<PlayerType>;
		InventorySlot = env.crownicles.gameDatabase.sequelize.models.InventorySlot as ModelStatic<InventorySlotType>;
		drinkModule = loadProductionModule<DrinkModule>("commands/player/DrinkCommand");
		collectors = loadProductionModule<CollectorsModule>("core/utils/ReactionsCollector");
		collectorPackets = loadProductionModule<CollectorPacketsModule>("../../Lib/src/packets/interaction/ReactionCollectorPacket");
		drinkPackets = loadProductionModule<DrinkPacketsModule>("../../Lib/src/packets/commands/CommandDrinkPacket");
		potions = loadProductionModule<PotionModule>("data/Potion");
		const {MapCache} = loadProductionModule<typeof import("../../src/core/maps/MapCache")>("core/maps/MapCache");
		MapCache.continentMapLinks = [MAP_LINK_ID];
		await pinInertDailyMission(env);
	});

	afterAll(async (): Promise<void> => {
		if (collectors) {
			for (const keycloakId of createdAccounts) {
				for (const collector of collectors.ReactionCollectorController.getCollectorsOfPlayer(keycloakId)) {
					await collector.end([]);
				}
			}
		}
		await env?.teardown();
	});

	async function createDrinker(keycloakId: string): Promise<PlayerType> {
		const player = await Player.create({keycloakId, health: INITIAL_HEALTH, level: 10, effectId: "", mapLinkId: MAP_LINK_ID});
		createdAccounts.add(keycloakId);
		await InventorySlot.bulkCreate(Object.values(ItemCategory).filter((category): category is number => typeof category === "number").map(itemCategory => ({
			playerId: player.id, slot: 0, itemCategory, itemId: itemCategory === ItemCategory.POTION ? POTION_ID : 0, itemLevel: 0
		})));
		return player;
	}

	it("grants one potion effect even when several frontends confirm stale menus", async (): Promise<void> => {
		const player = await createDrinker(KEYCLOAK_ID);
		const potion = potions.PotionDataController.instance.getById(POTION_ID)!;
		expect(potion.nature).toBe(ItemNature.HEALTH);
		const command = new drinkModule.default();
		const menus = await runAllOrThrow(Array.from({length: N_CONCURRENT}, async (_unused, index): Promise<string> => {
			const stalePlayer = await Player.findByPk(player.id);
			const response: CrowniclesPacket[] = [];
			const context: PacketContext = {
				keycloakId: KEYCLOAK_ID, frontEndOrigin: "integration-test", frontEndSubOrigin: "drink-race",
				...(index % 2 === 0 ? {webSocket: {}} : {discord: {user: "test-user", channel: "test-channel", interaction: "test-interaction", language: "fr", shardId: 0, isGuildAdministrator: false, isBotOwner: false}})
			};
			await command.execute(response, stalePlayer!, {}, context);
			const menu = response.find(packet => packet instanceof collectorPackets.ReactionCollectorCreationPacket);
			expect(menu).toBeDefined();
			return (menu as InstanceType<CollectorPacketsModule["ReactionCollectorCreationPacket"]>).id;
		}));
		const responses = await runAllOrThrow(menus.map(async (id): Promise<CrowniclesPacket[]> => {
			const response: CrowniclesPacket[] = [];
			await collectors.ReactionCollectorController.reactPacket(response, {id, keycloakId: KEYCLOAK_ID, reactionIndex: 0});
			return response;
		}));
		const fresh = await Player.findByPk(player.id);
		expect(fresh!.health).toBe(INITIAL_HEALTH + potion.power);
		expect(responses.flat().filter(packet => packet instanceof drinkPackets.CommandDrinkPacketRes)).toHaveLength(1);
		const inventory = await InventorySlot.findAll({where: {playerId: player.id, itemCategory: ItemCategory.POTION}});
		expect(inventory.every(slot => slot.itemId !== POTION_ID)).toBe(true);
	});

	it("opens one blocking menu for simultaneous Discord and app commands", async (): Promise<void> => {
		const keycloakId = `${KEYCLOAK_ID}-entry`;
		await createDrinker(keycloakId);
		const handler = env.crownicles.packetListener.getListener(drinkPackets.CommandDrinkPacketReq.name);
		const responses = await runAllOrThrow(Array.from({length: N_CONCURRENT}, async (_unused, index): Promise<CrowniclesPacket[]> => {
			const response: CrowniclesPacket[] = [];
			const context: PacketContext = {
				keycloakId, frontEndOrigin: "integration-test", frontEndSubOrigin: "drink-entry",
				...(index % 2 === 0 ? {webSocket: {}} : {discord: {user: "test-user", channel: "test-channel", interaction: "test-interaction", language: "fr", shardId: 0, isGuildAdministrator: false, isBotOwner: false}})
			};
			await handler(response, context, {});
			return response;
		}));
		try {
			expect(responses.flat().filter(packet => packet instanceof collectorPackets.ReactionCollectorCreationPacket)).toHaveLength(1);
		}
		finally {
			for (const collector of collectors.ReactionCollectorController.getCollectorsOfPlayer(keycloakId)) {
				await collector.end([]);
			}
		}
	});

	it("keeps accounts independent and lets the next command run after a failure", async (): Promise<void> => {
		const slowPlayer = await createDrinker(`${KEYCLOAK_ID}-slow`);
		const otherPlayer = await createDrinker(`${KEYCLOAK_ID}-other`);
		const {Players} = loadProductionModule<typeof import("../../src/core/database/game/models/Player")>("core/database/game/models/Player");
		const lookup = Players.getByKeycloakId.bind(Players);
		let release!: () => void;
		const pause = new Promise<void>(resolve => { release = resolve; });
		let firstLookup = true;
		const spy = vi.spyOn(Players, "getByKeycloakId").mockImplementation(async (keycloakId): Promise<PlayerType | null> => {
			if (keycloakId === slowPlayer.keycloakId && firstLookup) {
				firstLookup = false;
				await pause;
				throw new Error("command interrupted");
			}
			return await lookup(keycloakId);
		});
		const handler = env.crownicles.packetListener.getListener(drinkPackets.CommandDrinkPacketReq.name);
		const context: PacketContext = {keycloakId: slowPlayer.keycloakId, frontEndOrigin: "integration-test", frontEndSubOrigin: "queue-recovery", webSocket: {}};
		const nextResponse: CrowniclesPacket[] = [];
		const failed = handler([], context, {});
		const next = handler(nextResponse, context, {});
		try {
			const otherResponse: CrowniclesPacket[] = [];
			await handler(otherResponse, {...context, keycloakId: otherPlayer.keycloakId}, {});
			expect(otherResponse.some(packet => packet instanceof collectorPackets.ReactionCollectorCreationPacket)).toBe(true);
			expect(nextResponse).toEqual([]);
			release();
			await expect(failed).rejects.toThrow("command interrupted");
			await next;
			expect(nextResponse.some(packet => packet instanceof collectorPackets.ReactionCollectorCreationPacket)).toBe(true);
		}
		finally {
			release();
			await Promise.allSettled([failed, next]);
			spy.mockRestore();
		}
	});
});