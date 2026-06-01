import {
	afterAll, beforeAll, beforeEach, describe, expect, it
} from "vitest";
import type { ModelStatic } from "sequelize";
import {
	CoreTestEnvironment, loadProductionModule, runAllOrThrow, setupCoreForTests
} from "../_coreSetup";
import type { Player as PlayerType } from "../../src/core/database/game/models/Player";
import type { InventoryInfo as InventoryInfoType } from "../../src/core/database/game/models/InventoryInfo";
import { ItemCategory, ItemConstants } from "../../../Lib/src/constants/ItemConstants";
import { ReactionCollectorBuyCategorySlotReaction } from "../../../Lib/src/packets/interaction/ReactionCollectorBuyCategorySlot";

type TannerShopItemsModule = typeof import("../../src/core/utils/TannerShopItems");

const N_CONCURRENT = 25;

/**
 * Race test for {@link TannerShopItemsModule.getBuySlotExtensionShopItemCallback}.
 * The callback is the `EndCallback` fired by the reaction collector
 * after the player picks an item category to extend. It locks
 * `[Player, InventoryInfo]` so the money debit + slot increment are
 * atomic. There is no cap inside the callback (the cap lives in the
 * shop item factory), so the invariant is "no lost writes": racing N
 * callers must result in EXACTLY N debits and EXACTLY N slot
 * increments.
 */
describe("TannerShopItems.getBuySlotExtensionShopItemCallback race", () => {
	let env: CoreTestEnvironment;
	let Player: ModelStatic<PlayerType>;
	let InventoryInfo: ModelStatic<InventoryInfoType>;
	let tannerShopItems: TannerShopItemsModule;

	beforeAll(async () => {
		env = await setupCoreForTests("tannerbuyslot");
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
			await InventoryInfo.destroy({ truncate: true, force: true });
			await Player.destroy({ truncate: true, force: true });
		}
		finally {
			await env.crownicles.gameDatabase.sequelize.query("SET FOREIGN_KEY_CHECKS = 1");
		}
	});

	it(`preserves N=${N_CONCURRENT} debits and slot increments under race`, async () => {
		// The price of the next slot purchase depends on how many extra
		// slots the player already owns. We start fresh (1 slot per
		// category = baseSlots), so the first purchase price is index 0.
		const price = ItemConstants.SLOTS.PRICES[0];
		const initialMoney = price * (N_CONCURRENT + 1);

		const player = await Player.create({
			keycloakId: "race-tanner-buy-slot",
			money: initialMoney
		});
		await InventoryInfo.create({ playerId: player.id });

		// Build a minimal collector mock matching the surface used by the callback.
		const fakeCollector = {
			getFirstReaction: () => ({
				reaction: {
					type: ReactionCollectorBuyCategorySlotReaction.name,
					data: { categoryId: ItemCategory.WEAPON }
				}
			})
		} as unknown as Parameters<
			ReturnType<TannerShopItemsModule["getBuySlotExtensionShopItemCallback"]>
		>[0];

		const callback = tannerShopItems.getBuySlotExtensionShopItemCallback(player.id, price);

		await runAllOrThrow(
			Array.from({ length: N_CONCURRENT }, () => callback(fakeCollector, []))
		);

		const fresh = await Player.findByPk(player.id);
		const freshInv = await InventoryInfo.findByPk(player.id);
		expect(fresh).toBeTruthy();
		expect(freshInv).toBeTruthy();

		// No lost writes under concurrency.
		expect(fresh!.money).toBe(initialMoney - price * N_CONCURRENT);
		expect(freshInv!.weaponSlots).toBe(1 + N_CONCURRENT);
	});
});
