import {
	beforeEach, describe, expect, it, vi
} from "vitest";
import { smallEventFuncs } from "../../../src/core/smallEvents/ultimateFoodMerchant";
import { Guilds } from "../../../src/core/database/game/models/Guild";
import { BlessingManager } from "../../../src/core/blessings/BlessingManager";
import { RecipeDiscoveryService } from "../../../src/core/cooking/RecipeDiscoveryService";
import { giveFoodToGuild } from "../../../src/core/utils/FoodUtils";
import {
	generateRandomItem, giveItemToPlayer
} from "../../../src/core/utils/ItemUtils";
import { openRecipeShopOffer } from "../../../src/core/smallEvents/recipeShopOffer";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { SmallEventConstants } from "../../../../Lib/src/constants/SmallEventConstants";
import { PetConstants } from "../../../../Lib/src/constants/PetConstants";
import { ItemRarity } from "../../../../Lib/src/constants/ItemConstants";
import {
	GASPARD_JO_RECIPE_COSTS, RecipeDiscoverySource
} from "../../../../Lib/src/constants/CookingConstants";
import { RecipeShopSource } from "../../../../Lib/src/packets/interaction/ReactionCollectorRecipeShopSmallEvent";
import { SmallEventUltimateFoodMerchantPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventUltimateFoodMerchantPacket";
import {
	createTestPlayer, packetOf, packetsOf, runSmallEvent, TEST_CONTEXT, TestPlayer, useSmallEventHarness
} from "./SmallEventHarness";

vi.mock("../../../src/core/utils/FoodUtils", async importOriginal => ({
	...await importOriginal<typeof import("../../../src/core/utils/FoodUtils")>(),
	giveFoodToGuild: vi.fn().mockResolvedValue(undefined)
}));

vi.mock("../../../src/core/smallEvents/recipeShopOffer", () => ({
	openRecipeShopOffer: vi.fn()
}));

vi.mock("../../../src/core/utils/ItemUtils", async importOriginal => {
	const actual = await importOriginal<typeof import("../../../src/core/utils/ItemUtils")>();
	return {
		...actual,
		generateRandomItem: vi.fn(actual.generateRandomItem),
		giveItemToPlayer: vi.fn().mockResolvedValue(undefined)
	};
});

const NAMES = SmallEventConstants.ULTIMATE_FOOD_MERCHANT.INTERACTIONS_NAMES;
const FOOD_CAPACITY = 10;

type TestGuild = {
	ultimateFood: number;
	commonFood: number;
};

function mockGuild(guild: TestGuild): void {
	vi.spyOn(Guilds, "getById").mockResolvedValue({
		...guild,
		getFoodCapacityFor: (food: string) => (food === PetConstants.PET_FOOD.ULTIMATE_FOOD || food === PetConstants.PET_FOOD.COMMON_FOOD ? FOOD_CAPACITY : 0)
	} as never);
}

async function meet(player: TestPlayer): Promise<SmallEventUltimateFoodMerchantPacket> {
	return packetOf((await runSmallEvent(smallEventFuncs, player)).response, SmallEventUltimateFoodMerchantPacket);
}

describe("ultimate food merchant small event", () => {
	useSmallEventHarness();

	beforeEach(() => {
		vi.spyOn(Guilds, "getById").mockResolvedValue(null);
		vi.spyOn(RandomUtils, "variationInt").mockReturnValue(1);
		vi.spyOn(RandomUtils.crowniclesRandom, "bool").mockReturnValue(true);
		vi.spyOn(RecipeDiscoveryService, "peekNextDiscovery").mockResolvedValue(null);
		vi.spyOn(BlessingManager.getInstance(), "getMoneyMultiplier").mockReturnValue(1.5);
		vi.mocked(giveFoodToGuild).mockClear();
		vi.mocked(openRecipeShopOffer).mockClear();
		vi.mocked(generateRandomItem).mockClear();
		vi.mocked(giveItemToPlayer).mockClear();
	});

	it.each([
		["has no guild", (): void => undefined],
		["has a guild that cannot be loaded", (): void => {
			vi.spyOn(Guilds, "getById").mockRejectedValue(new Error("unknown guild"));
		}]
	])("gives money growing with the level to a player who %s and shows the blessed amount", async (_case, mockMissingGuild) => {
		mockMissingGuild();
		const player = createTestPlayer({
			level: 40, money: 0
		});

		const packet = await meet(player);

		expect(player.addMoney).toHaveBeenCalledWith(expect.objectContaining({ amount: 60 }));
		expect(packet).toEqual(expect.objectContaining({
			interactionName: NAMES.MONEY, amount: 90
		}));
		expect(player.save).toHaveBeenCalled();
	});

	describe("player from the good players level", () => {
		it("gives ultimate food to the guild, more with the level", async () => {
			mockGuild({
				ultimateFood: 2, commonFood: 0
			});
			const player = createTestPlayer({ level: 100 });

			const packet = await meet(player);

			// ceil(3 * tanh(1)) + 1
			expect(packet).toEqual(expect.objectContaining({
				interactionName: NAMES.ULTIMATE_FOOD, amount: 4
			}));
			expect(giveFoodToGuild).toHaveBeenCalledWith(expect.any(Array), player, NAMES.ULTIMATE_FOOD, 4, expect.anything());
		});

		it("does not give more ultimate food than the guild can store", async () => {
			mockGuild({
				ultimateFood: FOOD_CAPACITY - 2, commonFood: 0
			});

			expect((await meet(createTestPlayer({ level: 100 }))).amount).toBe(2);
		});

		it("gives at least one ultimate food", async () => {
			mockGuild({
				ultimateFood: 0, commonFood: 0
			});
			vi.spyOn(RandomUtils, "variationInt").mockReturnValue(-4);

			expect((await meet(createTestPlayer({ level: SmallEventConstants.ULTIMATE_FOOD_MERCHANT.MINIMUM_LEVEL_GOOD_PLAYER }))).amount).toBe(1);
		});

		it("only tells a player whose guild is full of ultimate food", async () => {
			mockGuild({
				ultimateFood: FOOD_CAPACITY, commonFood: 0
			});

			const packet = await meet(createTestPlayer({ level: 100 }));

			expect(packet.interactionName).toBe(NAMES.FULL_ULTIMATE_FOOD);
			expect(packet.amount).toBeUndefined();
			expect(giveFoodToGuild).not.toHaveBeenCalled();
		});

		it.each([
			[100, ItemRarity.RARE, ItemRarity.LEGENDARY],
			[30, ItemRarity.UNCOMMON, ItemRarity.RARE]
		])("gives a level %i player an item between the rarities %i and %i the other half of the time", async (level, minRarity, maxRarity) => {
			mockGuild({
				ultimateFood: 0, commonFood: 0
			});
			vi.spyOn(RandomUtils.crowniclesRandom, "bool").mockReturnValue(false);
			const player = createTestPlayer({ level });

			const packet = await meet(player);

			expect(packet.interactionName).toBe(NAMES.ITEM);
			expect(generateRandomItem).toHaveBeenCalledWith({
				minRarity, maxRarity
			});
			const item = vi.mocked(generateRandomItem).mock.results[0].value;
			expect(giveItemToPlayer).toHaveBeenCalledWith(expect.any(Array), TEST_CONTEXT, player, item, expect.objectContaining({ itemLevel: expect.any(Number) }));
			expect(giveFoodToGuild).not.toHaveBeenCalled();
		});
	});

	describe("player below the good players level", () => {
		const level = SmallEventConstants.ULTIMATE_FOOD_MERCHANT.MINIMUM_LEVEL_GOOD_PLAYER - 1;

		it("gives common food to the guild", async () => {
			mockGuild({
				ultimateFood: 0, commonFood: 0
			});
			const player = createTestPlayer({ level });

			const packet = await meet(player);

			// ceil(6 * tanh(0.29)) + 1
			expect(packet).toEqual(expect.objectContaining({
				interactionName: NAMES.COMMON_FOOD, amount: 3
			}));
			expect(giveFoodToGuild).toHaveBeenCalledWith(expect.any(Array), player, NAMES.COMMON_FOOD, 3, expect.anything());
			expect(RandomUtils.crowniclesRandom.bool).not.toHaveBeenCalled();
		});

		it("does not give more common food than the guild can store", async () => {
			mockGuild({
				ultimateFood: 0, commonFood: FOOD_CAPACITY - 1
			});

			expect((await meet(createTestPlayer({ level }))).amount).toBe(1);
		});

		it("only tells a player whose guild is full of common food", async () => {
			mockGuild({
				ultimateFood: 0, commonFood: FOOD_CAPACITY
			});

			const packet = await meet(createTestPlayer({ level }));

			expect(packet.interactionName).toBe(NAMES.FULL_COMMON_FOOD);
			expect(giveFoodToGuild).not.toHaveBeenCalled();
		});
	});

	describe("recipe offer", () => {
		const offer = {
			cost: 500, recipe: { id: "recipe" }
		};

		beforeEach(() => {
			vi.spyOn(RecipeDiscoveryService, "peekNextDiscovery").mockResolvedValue(offer as never);
		});

		it("offers a recipe to a player who can afford it, with the reward of the merchant", async () => {
			const player = createTestPlayer({
				level: 10, money: 470
			});

			const { response } = await runSmallEvent(smallEventFuncs, player);

			expect(RecipeDiscoveryService.peekNextDiscovery).toHaveBeenCalledWith(player, RecipeDiscoverySource.GASPARD_JO, GASPARD_JO_RECIPE_COSTS);
			expect(openRecipeShopOffer).toHaveBeenCalledWith({
				response,
				player,
				context: TEST_CONTEXT,
				source: RecipeShopSource.GASPARD_JO,
				offer,
				ultimateFoodMerchant: {
					interactionName: NAMES.MONEY, amount: 45
				}
			});
			expect(packetsOf(response, SmallEventUltimateFoodMerchantPacket)).toHaveLength(0);
		});

		it("does not offer a recipe to a player who cannot afford it", async () => {
			const player = createTestPlayer({
				level: 10, money: 469
			});

			const { response } = await runSmallEvent(smallEventFuncs, player);

			expect(openRecipeShopOffer).not.toHaveBeenCalled();
			expect(packetsOf(response, SmallEventUltimateFoodMerchantPacket)).toHaveLength(1);
		});
	});
});
