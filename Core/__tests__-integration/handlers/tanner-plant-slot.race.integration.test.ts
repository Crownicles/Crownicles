import {
	afterAll, beforeAll, beforeEach, describe, expect, it
} from "vitest";
import type { ModelStatic } from "sequelize";
import {
	CoreTestEnvironment, loadProductionModule, runAllOrThrow, setupCoreForTests
} from "../_coreSetup";
import type { Player as PlayerType } from "../../src/core/database/game/models/Player";
import type { InventoryInfo as InventoryInfoType } from "../../src/core/database/game/models/InventoryInfo";
import { PlantConstants } from "../../../Lib/src/constants/PlantConstants";

type TannerShopItemsModule = typeof import("../../src/core/utils/TannerShopItems");

const N_CONCURRENT = 25;

/**
 * Race test for {@link TannerShopItemsModule.getPlantSlotExtensionShopItem}'s
 * `buyCallback`. The previous (broken) design split the cap check,
 * the money debit and the slot increment across separate
 * transactions, so two concurrent buys at `MAX-1` both paid and only
 * one slot was granted (#3760). After the fix every step lives inside
 * `withLockedEntitiesSafe([Player, InventoryInfo])`. The invariant:
 * starting from `plantSlots = MAX - 1`, racing N callers must result
 * in exactly ONE slot added and exactly ONE price debited.
 */
describe("TannerShopItems.getPlantSlotExtensionShopItem race", () => {
	let env: CoreTestEnvironment;
	let Player: ModelStatic<PlayerType>;
	let InventoryInfo: ModelStatic<InventoryInfoType>;
	let tannerShopItems: TannerShopItemsModule;

	beforeAll(async () => {
		env = await setupCoreForTests("tannerplantslot");
		Player = env.crownicles.gameDatabase.sequelize.models.Player as ModelStatic<PlayerType>;
		InventoryInfo = env.crownicles.gameDatabase.sequelize.models.InventoryInfo as ModelStatic<InventoryInfoType>;
		tannerShopItems = loadProductionModule<TannerShopItemsModule>(
			"core/utils/TannerShopItems"
		);
	});

	afterAll(async () => {
		await env?.teardown();
	});

	beforeEach(async () => {
		await env.crownicles.gameDatabase.sequelize.query("SET FOREIGN_KEY_CHECKS = 0");
		try {
			await env.crownicles.gameDatabase.sequelize.query("TRUNCATE TABLE player_plant_slots");
			await InventoryInfo.destroy({ truncate: true, force: true });
			await Player.destroy({ truncate: true, force: true });
		}
		finally {
			await env.crownicles.gameDatabase.sequelize.query("SET FOREIGN_KEY_CHECKS = 1");
		}
	});

	it(`grants exactly one slot when ${N_CONCURRENT} callers race at MAX-1`, async () => {
		// Pick the price for the LAST upgrade (the MAX-1 -> MAX transition).
		const priceIndex = PlantConstants.MAX_PLANT_SLOTS - 1 - PlantConstants.DEFAULT_PLANT_SLOTS;
		const price = PlantConstants.PLANT_SLOT_PRICES[priceIndex];
		const initialMoney = price * (N_CONCURRENT + 1);

		const player = await Player.create({
			keycloakId: "race-tanner-plant-slot",
			money: initialMoney
		});
		await InventoryInfo.create({
			playerId: player.id,
			plantSlots: PlantConstants.MAX_PLANT_SLOTS - 1
		});

		const item = await tannerShopItems.getPlantSlotExtensionShopItem(player.id);
		expect(item).not.toBeNull();

		await runAllOrThrow(
			Array.from({ length: N_CONCURRENT }, () => item!.buyCallback([], player.id))
		);

		const fresh = await Player.findByPk(player.id);
		expect(fresh).toBeTruthy();
		const freshInv = await InventoryInfo.findByPk(player.id);
		expect(freshInv).toBeTruthy();

		// Exactly one slot was added, exactly one price was debited.
		expect(freshInv!.plantSlots).toBe(PlantConstants.MAX_PLANT_SLOTS);
		expect(fresh!.money).toBe(initialMoney - price);
	});
});
