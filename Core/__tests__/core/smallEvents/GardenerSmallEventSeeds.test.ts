import {
	beforeEach, describe, expect, it, vi
} from "vitest";
import { smallEventFuncs } from "../../../src/core/smallEvents/gardener";
import { Homes } from "../../../src/core/database/game/models/Home";
import { HomeGardenSlots } from "../../../src/core/database/game/models/HomeGardenSlot";
import { PlayerPlantSlots } from "../../../src/core/database/game/models/PlayerPlantSlot";
import { InventoryInfos } from "../../../src/core/database/game/models/InventoryInfo";
import { InventorySlots } from "../../../src/core/database/game/models/InventorySlot";
import { PetEntities } from "../../../src/core/database/game/models/PetEntity";
import { PetDataController } from "../../../src/data/Pet";
import { LogsReadRequests } from "../../../src/core/database/logs/LogsReadRequests";
import { MaterialDataController } from "../../../src/data/Material";
import { givePlantsToPlayer } from "../../../src/core/utils/PlantDeliveryUtils";
import {
	applyMaterialLoot, updateCollectMaterialsMission
} from "../../../src/core/utils/MaterialLootUtils";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import {
	GARDENER_ADVICE, GARDENER_INTERACTIONS, PlantConstants, PlantId, SEED_CONDITION_FAILURE, SEED_CONDITION_SUCCESS, SeedConditionKey
} from "../../../../Lib/src/constants/PlantConstants";
import { PetConstants } from "../../../../Lib/src/constants/PetConstants";
import { ClassConstants } from "../../../../Lib/src/constants/ClassConstants";
import {
	ItemConstants, ItemRarity
} from "../../../../Lib/src/constants/ItemConstants";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { MaterialRarity } from "../../../../Lib/src/types/MaterialRarity";
import { GardenEarthQuality } from "../../../../Lib/src/types/GardenEarthQuality";
import {
	ReactionCollectorAcceptReaction, ReactionCollectorRefuseReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { SmallEventGardenerPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventGardenerPacket";
import { CrowniclesPacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	createTestPlayer, endWithoutReaction, ignoresOtherPlayers, isBlocked, packetOf, packetsOf, reactWith, runSmallEvent, SmallEventRun, TEST_NOW, TestPlayer, useSmallEventHarness
} from "./SmallEventHarness";

vi.mock("../../../src/core/utils/withLockedPlayerAndMissionsSafe", async () => ({
	withLockedPlayerAndMissionsSafe: (await import("./SmallEventHarness")).lockedPlayerPassthrough
}));

vi.mock("../../../src/core/utils/PlantDeliveryUtils", async importOriginal => ({
	...await importOriginal<typeof import("../../../src/core/utils/PlantDeliveryUtils")>(),
	givePlantsToPlayer: vi.fn()
}));

vi.mock("../../../src/core/utils/MaterialLootUtils", () => ({
	applyMaterialLoot: vi.fn().mockResolvedValue(undefined),
	updateCollectMaterialsMission: vi.fn().mockResolvedValue(undefined)
}));

type TestGardenSlot = {
	plantId: number;
	plantedAt: Date | null;
	isEmpty: () => boolean;
	isReady: () => boolean;
};

type PetModel = {
	rarity?: number;
	tags?: string[];
	herbivore?: boolean;
	carnivore?: boolean;
};

function mockHome(gardenPlots = 4, gardenEarthQuality = GardenEarthQuality.RICH): void {
	vi.spyOn(Homes, "getOfPlayer").mockResolvedValue({
		id: 9,
		getLevel: () => ({
			features: {
				gardenPlots, gardenEarthQuality
			}
		})
	} as never);
}

/**
 * The player's next seed is the one following the highest plant of their garden
 */
function mockNextSeed(seedId: PlantId | null): void {
	vi.spyOn(HomeGardenSlots, "getHighestPlantedId").mockResolvedValue(seedId === null ? PlantConstants.MAX_PLANT_ID : seedId - 1);
}

function mockPet(lovePoints: number, model: PetModel = {}): void {
	vi.spyOn(PetEntities, "getById").mockResolvedValue({
		typeId: 1, lovePoints
	} as never);
	vi.spyOn(PetDataController.instance, "getById").mockReturnValue({
		rarity: model.rarity ?? ItemRarity.COMMON,
		hasTag: (tag: string) => (model.tags ?? []).includes(tag),
		canEatVegetables: () => model.herbivore ?? false,
		canEatMeat: () => model.carnivore ?? false
	} as never);
}

function gardenSlot(plantId: number, ready = false): TestGardenSlot {
	return {
		plantId,
		plantedAt: plantId === 0 ? null : TEST_NOW,
		isEmpty: () => plantId === 0,
		isReady: () => ready
	};
}

function gardenerPacket(response: CrowniclesPacket[]): SmallEventGardenerPacket {
	return packetOf(response, SmallEventGardenerPacket);
}

describe("gardener small event seeds and gifts", () => {
	useSmallEventHarness();
	let player: TestPlayer;

	async function meet(): Promise<SmallEventRun> {
		return await runSmallEvent(smallEventFuncs, player);
	}

	async function meetPacket(): Promise<SmallEventGardenerPacket> {
		return gardenerPacket((await meet()).response);
	}

	beforeEach(() => {
		player = createTestPlayer({
			level: 100, money: 0
		});
		mockHome();
		vi.spyOn(InventoryInfos, "getOfPlayer").mockResolvedValue({ plantSlots: 1 } as never);
		vi.spyOn(PlayerPlantSlots, "initializeSlots").mockResolvedValue();
		vi.spyOn(PlayerPlantSlots, "getSeedSlot").mockResolvedValue(null);
		vi.spyOn(PlayerPlantSlots, "setSeed").mockResolvedValue();
		vi.spyOn(LogsReadRequests, "getSmallEventEncounterCount").mockResolvedValue(2);
		vi.spyOn(LogsReadRequests, "hasSleptInInnDuringLast").mockResolvedValue(false);
		vi.spyOn(PetEntities, "getById").mockResolvedValue(null);
		vi.spyOn(MaterialDataController.instance, "getRandomMaterialFromRarity").mockReturnValue({ id: "5" } as never);
		vi.mocked(givePlantsToPlayer).mockReset().mockResolvedValue({
			delivered: true, toHomeStorage: 0, toPlantSlots: 1
		});
		vi.mocked(applyMaterialLoot).mockClear();
		vi.mocked(updateCollectMaterialsMission).mockClear();
	});

	describe("free seed", () => {
		it("gives the common herb seed to a player without garden", async () => {
			vi.spyOn(Homes, "getOfPlayer").mockResolvedValue(null);
			player.level = PlantConstants.SEED_LEVEL_REQUIREMENTS[PlantId.COMMON_HERB];

			const packet = await meetPacket();

			expect(packet).toEqual(expect.objectContaining({
				interactionName: GARDENER_INTERACTIONS.SEED, conditionKey: SEED_CONDITION_SUCCESS.FREE, plantId: PlantId.COMMON_HERB, cost: 0, isFirstEncounter: false
			}));
			expect(PlayerPlantSlots.setSeed).toHaveBeenCalledWith(player.id, PlantId.COMMON_HERB);
			expect(PlayerPlantSlots.initializeSlots).toHaveBeenCalledWith(player.id, 1);
			expect(player.money).toBe(0);
			expect(player.spendMoney).not.toHaveBeenCalled();
		});

		it("tells the story of the gardener on the first encounter", async () => {
			vi.spyOn(LogsReadRequests, "getSmallEventEncounterCount").mockResolvedValue(1);
			mockNextSeed(PlantId.COMMON_HERB);

			expect((await meetPacket()).isFirstEncounter).toBe(true);
			expect(LogsReadRequests.getSmallEventEncounterCount).toHaveBeenCalledWith(player.keycloakId, "gardener");
		});

		it("refuses the seed to a player below its level", async () => {
			mockNextSeed(PlantId.COMMON_HERB);
			player.level = PlantConstants.SEED_LEVEL_REQUIREMENTS[PlantId.COMMON_HERB] - 1;

			const packet = await meetPacket();

			expect(packet).toMatchObject({
				interactionName: GARDENER_INTERACTIONS.ADVICE, conditionKey: SEED_CONDITION_FAILURE.NEED_LEVEL, plantId: PlantId.COMMON_HERB
			});
			expect(PlayerPlantSlots.setSeed).not.toHaveBeenCalled();
		});
	});

	describe("paid seed", () => {
		const cost = PlantConstants.SEED_COSTS[PlantId.GOLDEN_CLOVER];

		beforeEach(() => {
			mockNextSeed(PlantId.GOLDEN_CLOVER);
			player.money = cost;
		});

		it("offers the seed for its price to a player who can afford it", async () => {
			const run = await meet();

			expect(run.collector?.creationPacket.data.data).toMatchObject({
				seedId: PlantId.GOLDEN_CLOVER, cost, conditionKey: SEED_CONDITION_SUCCESS.PAID, isFirstEncounter: false
			});
			expect(run.response).toContain(run.collector?.creationPacket);
			expect(isBlocked(player)).toBe(true);
			expect(await ignoresOtherPlayers(run)).toBe(true);
		});

		it("sells the seed to a player who accepts", async () => {
			const response = await reactWith(await meet(), ReactionCollectorAcceptReaction);

			expect(gardenerPacket(response)).toEqual(expect.objectContaining({
				interactionName: GARDENER_INTERACTIONS.SEED, conditionKey: SEED_CONDITION_SUCCESS.PAID_ACCEPTED, plantId: PlantId.GOLDEN_CLOVER, cost
			}));
			expect(player.money).toBe(0);
			expect(player.spendMoney).toHaveBeenCalledWith(expect.objectContaining({
				amount: cost, reason: NumberChangeReason.SMALL_EVENT
			}));
			expect(player.save).toHaveBeenCalled();
			expect(PlayerPlantSlots.setSeed).toHaveBeenCalledWith(player.id, PlantId.GOLDEN_CLOVER);
			expect(isBlocked(player)).toBe(false);
		});

		it("does not sell the seed to a player who spent their money in the meantime", async () => {
			const run = await meet();
			player.money = cost - 1;

			const response = await reactWith(run, ReactionCollectorAcceptReaction);

			expect(gardenerPacket(response)).toEqual(expect.objectContaining({
				interactionName: GARDENER_INTERACTIONS.ADVICE, conditionKey: SEED_CONDITION_FAILURE.NEED_MONEY, plantId: PlantId.GOLDEN_CLOVER, cost: 0
			}));
			expect(player.money).toBe(cost - 1);
			expect(PlayerPlantSlots.setSeed).not.toHaveBeenCalled();
		});

		it.each([
			["refuses", (run: SmallEventRun): Promise<CrowniclesPacket[]> => reactWith(run, ReactionCollectorRefuseReaction)],
			["does not answer", endWithoutReaction]
		])("keeps the seed when the player %s", async (_case, answer) => {
			const response = await answer(await meet());

			expect(gardenerPacket(response)).toEqual(expect.objectContaining({
				interactionName: GARDENER_INTERACTIONS.ADVICE, conditionKey: SEED_CONDITION_FAILURE.REFUSED, plantId: PlantId.GOLDEN_CLOVER, materialId: 0, cost: 0
			}));
			expect(player.money).toBe(cost);
			expect(PlayerPlantSlots.setSeed).not.toHaveBeenCalled();
			expect(isBlocked(player)).toBe(false);
		});

		it("does not offer the seed to a player who cannot afford it", async () => {
			player.money = cost - 1;

			const run = await meet();

			expect(run.collector).toBeUndefined();
			expect(gardenerPacket(run.response)).toMatchObject({
				interactionName: GARDENER_INTERACTIONS.ADVICE, conditionKey: SEED_CONDITION_FAILURE.NEED_MONEY, plantId: PlantId.GOLDEN_CLOVER
			});
		});
	});

	describe("seeds with a condition", () => {
		async function expectCondition(seedId: PlantId, conditionKey: SeedConditionKey): Promise<void> {
			mockNextSeed(seedId);
			vi.mocked(PlayerPlantSlots.setSeed).mockClear();
			const packet = await meetPacket();
			const isGiven = (Object.values(SEED_CONDITION_SUCCESS) as SeedConditionKey[]).includes(conditionKey);
			expect(packet).toMatchObject({
				interactionName: isGiven ? GARDENER_INTERACTIONS.SEED : GARDENER_INTERACTIONS.ADVICE, conditionKey, plantId: seedId
			});
			if (isGiven) {
				expect(PlayerPlantSlots.setSeed).toHaveBeenCalledWith(player.id, seedId);
			}
			else {
				expect(PlayerPlantSlots.setSeed).not.toHaveBeenCalled();
			}
		}

		it.each([
			[20, SEED_CONDITION_FAILURE.NEED_MOONLIGHT],
			[21, SEED_CONDITION_SUCCESS.NIGHT],
			[5, SEED_CONDITION_SUCCESS.NIGHT],
			[6, SEED_CONDITION_FAILURE.NEED_MOONLIGHT]
		])("hands over the lunar moss at %ih only at night", async (hour, conditionKey) => {
			vi.setSystemTime(new Date(2026, 10, 14, hour, 30, 0));
			await expectCondition(PlantId.LUNAR_MOSS, conditionKey);
		});

		it("hands over the night mushroom at night", async () => {
			vi.setSystemTime(new Date(2026, 10, 14, 23, 0, 0));
			await expectCondition(PlantId.NIGHT_MUSHROOM, SEED_CONDITION_SUCCESS.NIGHT);
			expect(PlayerPlantSlots.setSeed).toHaveBeenCalledWith(player.id, PlantId.NIGHT_MUSHROOM);
		});

		it("hands over the night mushroom to a player who slept in an inn, but asks for the night otherwise", async () => {
			await expectCondition(PlantId.NIGHT_MUSHROOM, SEED_CONDITION_FAILURE.NEED_NIGHT);

			vi.spyOn(LogsReadRequests, "hasSleptInInnDuringLast").mockResolvedValue(true);
			await expectCondition(PlantId.NIGHT_MUSHROOM, SEED_CONDITION_SUCCESS.INN_NIGHT);
			expect(LogsReadRequests.hasSleptInInnDuringLast).toHaveBeenCalledWith(player.keycloakId, PlantConstants.INN_NIGHT_FAVOR_DURATION);
		});

		describe("venomous leaf and ancestral tree", () => {
			beforeEach(() => {
				player.petId = 4;
			});

			it("hand the venomous leaf over to a player with a trained herbivorous pet", async () => {
				mockPet(PetConstants.TRAINED_LOVE_THRESHOLD, { herbivore: true });
				await expectCondition(PlantId.VENOMOUS_LEAF, SEED_CONDITION_SUCCESS.HERBIVORE_PET);
			});

			it.each([
				["an untrained herbivorous pet", PetConstants.TRAINED_LOVE_THRESHOLD - 1, true],
				["a trained carnivorous pet", PetConstants.TRAINED_LOVE_THRESHOLD, false]
			])("keep the venomous leaf from a player with %s", async (_case, lovePoints, herbivore) => {
				mockPet(lovePoints, { herbivore });
				await expectCondition(PlantId.VENOMOUS_LEAF, SEED_CONDITION_FAILURE.NEED_HERBIVORE_PET);
			});

			it("keep the venomous leaf from a player without pet, or whose pet kind is unknown", async () => {
				player.petId = null;
				await expectCondition(PlantId.VENOMOUS_LEAF, SEED_CONDITION_FAILURE.NEED_HERBIVORE_PET);

				player.petId = 4;
				mockPet(PetConstants.TRAINED_LOVE_THRESHOLD, { herbivore: true });
				vi.spyOn(PetDataController.instance, "getById").mockReturnValue(undefined);
				await expectCondition(PlantId.VENOMOUS_LEAF, SEED_CONDITION_FAILURE.NEED_HERBIVORE_PET);
			});

			it("hand the ancestral tree over only to a player with a trained herbivorous pet of a rare kind", async () => {
				mockPet(PetConstants.TRAINED_LOVE_THRESHOLD, {
					herbivore: true, rarity: PlantConstants.RARE_PET_SEED_MIN_RARITY
				});
				await expectCondition(PlantId.ANCIENT_TREE, SEED_CONDITION_SUCCESS.LEGENDARY_HERBIVORE_PET);

				mockPet(PetConstants.TRAINED_LOVE_THRESHOLD, {
					herbivore: true, rarity: PlantConstants.RARE_PET_SEED_MIN_RARITY - 1
				});
				await expectCondition(PlantId.ANCIENT_TREE, SEED_CONDITION_FAILURE.NEED_LEGENDARY_HERBIVORE_PET);
			});
		});

		describe("fire bulb", () => {
			function mockEquipment(fireSlot: "weapon" | "armor" | "object" | null): void {
				const slot = (isFire: boolean): unknown => ({ getItem: () => ({ tags: isFire ? [ItemConstants.TAGS.FIRE] : [] }) });
				vi.spyOn(InventorySlots, "getMainWeaponSlot").mockResolvedValue(slot(fireSlot === "weapon") as never);
				vi.spyOn(InventorySlots, "getMainArmorSlot").mockResolvedValue(slot(fireSlot === "armor") as never);
				vi.spyOn(InventorySlots, "getMainObjectSlot").mockResolvedValue(slot(fireSlot === "object") as never);
			}

			beforeEach(() => {
				mockEquipment(null);
			});

			it("is handed over to a mystic mage", async () => {
				player.class = ClassConstants.CLASSES_ID.MYSTIC_MAGE;
				await expectCondition(PlantId.FIRE_BULB, SEED_CONDITION_SUCCESS.MAGE);
			});

			it("is handed over to a player with a fire pet", async () => {
				player.petId = 4;
				mockPet(0, { tags: [PetConstants.TAGS.FIRE] });
				await expectCondition(PlantId.FIRE_BULB, SEED_CONDITION_SUCCESS.FIRE_PET);
			});

			it.each(["weapon", "armor", "object"] as const)("is handed over to a player with an equipped fire %s", async fireSlot => {
				mockEquipment(fireSlot);
				await expectCondition(PlantId.FIRE_BULB, SEED_CONDITION_SUCCESS.FIRE_ITEM);
			});

			it("is kept from a player without fire affinity", async () => {
				player.petId = 4;
				mockPet(0, { tags: [PetConstants.TAGS.FLYING] });
				vi.spyOn(InventorySlots, "getMainWeaponSlot").mockResolvedValue(null);
				vi.spyOn(InventorySlots, "getMainArmorSlot").mockResolvedValue({ getItem: () => null } as never);
				vi.spyOn(InventorySlots, "getMainObjectSlot").mockResolvedValue({ getItem: () => ({}) } as never);
				await expectCondition(PlantId.FIRE_BULB, SEED_CONDITION_FAILURE.NEED_FIRE_AFFINITY);
			});

			it("is kept from a player whose pet kind is unknown", async () => {
				player.petId = 4;
				mockPet(0, { tags: [PetConstants.TAGS.FIRE] });
				vi.spyOn(PetDataController.instance, "getById").mockReturnValue(undefined);
				await expectCondition(PlantId.FIRE_BULB, SEED_CONDITION_FAILURE.NEED_FIRE_AFFINITY);
			});
		});

		describe("meat plant", () => {
			it("is handed over to a player with a carnivorous pet of a rare kind", async () => {
				player.petId = 4;
				mockPet(0, {
					carnivore: true, rarity: PlantConstants.RARE_PET_SEED_MIN_RARITY
				});
				await expectCondition(PlantId.MEAT_PLANT, SEED_CONDITION_SUCCESS.CARNIVORE_PET);
			});

			it.each([
				["a carnivorous pet of a common kind", {
					carnivore: true, rarity: PlantConstants.RARE_PET_SEED_MIN_RARITY - 1
				}],
				["a rare herbivorous pet", {
					carnivore: false, rarity: PlantConstants.RARE_PET_SEED_MIN_RARITY
				}]
			])("is kept from a player with %s", async (_case, model) => {
				player.petId = 4;
				mockPet(0, model);
				await expectCondition(PlantId.MEAT_PLANT, SEED_CONDITION_FAILURE.NEED_CARNIVORE_PET);
			});

			it("is kept from a player without pet, or whose pet kind is unknown", async () => {
				await expectCondition(PlantId.MEAT_PLANT, SEED_CONDITION_FAILURE.NEED_CARNIVORE_PET);

				player.petId = 4;
				mockPet(0, { carnivore: true });
				vi.spyOn(PetDataController.instance, "getById").mockReturnValue(undefined);
				await expectCondition(PlantId.MEAT_PLANT, SEED_CONDITION_FAILURE.NEED_CARNIVORE_PET);
			});
		});

		it.each([PlantId.IRON_ROOT, PlantId.CRYSTAL_FLOWER])("sells the seed %i without other condition", async seedId => {
			mockNextSeed(seedId);
			player.money = PlantConstants.SEED_COSTS[seedId];

			const run = await meet();

			expect(run.collector?.creationPacket.data.data).toMatchObject({
				seedId, cost: PlantConstants.SEED_COSTS[seedId], conditionKey: SEED_CONDITION_SUCCESS.PAID
			});
		});
	});

	it("explains to a player who still carries a seed that they must plant it, with a consolation gift", async () => {
		vi.spyOn(PlayerPlantSlots, "getSeedSlot").mockResolvedValue({ plantId: PlantId.COMMON_HERB } as never);
		vi.spyOn(RandomUtils.crowniclesRandom, "bool").mockReturnValue(false);

		const packet = await meetPacket();

		expect(packet).toEqual(expect.objectContaining({
			interactionName: GARDENER_INTERACTIONS.ADVICE, conditionKey: SEED_CONDITION_FAILURE.SEED_SLOT_FULL, plantId: 0, consolation: { materialId: 5 }
		}));
		expect(MaterialDataController.instance.getRandomMaterialFromRarity).toHaveBeenCalledWith(MaterialRarity.COMMON);
		expect(applyMaterialLoot).toHaveBeenCalledWith(player.id, [{
			materialId: 5, quantity: 1
		}]);
		expect(PlayerPlantSlots.setSeed).not.toHaveBeenCalled();
	});

	it("gives no consolation when there is neither room for a plant nor a material", async () => {
		vi.spyOn(PlayerPlantSlots, "getSeedSlot").mockResolvedValue({ plantId: PlantId.COMMON_HERB } as never);
		vi.spyOn(RandomUtils.crowniclesRandom, "bool").mockReturnValue(true);
		vi.mocked(givePlantsToPlayer).mockResolvedValue({
			delivered: false, reason: "plantSlotsFull" as never
		});
		vi.spyOn(MaterialDataController.instance, "getRandomMaterialFromRarity").mockReturnValue(undefined);

		const packet = await meetPacket();

		expect(packet.conditionKey).toBe(SEED_CONDITION_FAILURE.SEED_SLOT_FULL);
		expect(packet.consolation).toBeUndefined();
	});

	it("is not guaranteed to a player who obtained every seed, nor who cannot obtain the next one", async () => {
		const isGuaranteed = smallEventFuncs.isGuaranteed;
		if (!isGuaranteed) {
			throw new Error("The gardener can be guaranteed");
		}
		mockNextSeed(null);
		expect(await isGuaranteed(player as never)).toBe(false);

		mockNextSeed(PlantId.GOLDEN_CLOVER);
		player.money = 0;
		expect(await isGuaranteed(player as never)).toBe(false);

		player.money = PlantConstants.SEED_COSTS[PlantId.GOLDEN_CLOVER];
		expect(await isGuaranteed(player as never)).toBe(true);
	});

	it("tells where a plant consolation went", async () => {
		vi.spyOn(PlayerPlantSlots, "getSeedSlot").mockResolvedValue({ plantId: PlantId.COMMON_HERB } as never);
		vi.spyOn(RandomUtils.crowniclesRandom, "bool").mockReturnValue(true);
		vi.mocked(givePlantsToPlayer).mockResolvedValue({
			delivered: true, toHomeStorage: 1, toPlantSlots: 0
		});

		const packet = await meetPacket();

		expect(RandomUtils.crowniclesRandom.bool).toHaveBeenCalledWith(PlantConstants.GARDENER_CONSOLATION_PLANT_PROBABILITY);
		expect(packet.consolation).toEqual({
			plantId: expect.any(Number), sentToHomeStorage: true
		});
		expect(applyMaterialLoot).not.toHaveBeenCalled();
	});

	describe("player who obtained every seed", () => {
		function mockFallback(roll: number): void {
			mockNextSeed(null);
			vi.spyOn(RandomUtils.crowniclesRandom, "real").mockReturnValue(roll);
		}

		it("gives advice on the lowest rolls", async () => {
			mockFallback(PlantConstants.GARDENER_FALLBACK_PROBABILITIES.ADVICE - 0.01);

			expect(await meetPacket()).toEqual(expect.objectContaining({
				interactionName: GARDENER_INTERACTIONS.ADVICE, conditionKey: SEED_CONDITION_FAILURE.ALL_SEEDS_OBTAINED, plantId: 0, materialId: 0, cost: 0, isFirstEncounter: false
			}));
			expect(givePlantsToPlayer).not.toHaveBeenCalled();
		});

		describe("generic advice", () => {
			beforeEach(() => {
				mockFallback(PlantConstants.GARDENER_FALLBACK_PROBABILITIES.ADVICE);
			});

			it.each([
				["a plant is ready to harvest", [gardenSlot(PlantId.COMMON_HERB, true), gardenSlot(0)], GardenEarthQuality.POOR, GARDENER_ADVICE.TIP_HARVEST_READY],
				["a plot is empty", [gardenSlot(PlantId.COMMON_HERB), gardenSlot(0)], GardenEarthQuality.POOR, GARDENER_ADVICE.TIP_EMPTY_PLOTS],
				["the soil is poor", [gardenSlot(PlantId.COMMON_HERB)], GardenEarthQuality.POOR, GARDENER_ADVICE.TIP_UPGRADE_SOIL],
				["the soil is poor, whatever an unplanted or unknown plant says", [
					{
						...gardenSlot(PlantId.COMMON_HERB, true), plantedAt: null
					},
					gardenSlot(PlantConstants.MAX_PLANT_ID + 1, true)
				], GardenEarthQuality.POOR, GARDENER_ADVICE.TIP_UPGRADE_SOIL],
				["nothing is left to improve", [gardenSlot(PlantId.COMMON_HERB)], GardenEarthQuality.AVERAGE, GARDENER_ADVICE.TIP_GENERIC]
			])("tells when %s", async (_case, slots, earthQuality, conditionKey) => {
				mockHome(4, earthQuality);
				vi.spyOn(HomeGardenSlots, "getOfHome").mockResolvedValue(slots as never);

				expect(await meetPacket()).toMatchObject({
					interactionName: GARDENER_INTERACTIONS.ADVICE, conditionKey
				});
				expect(HomeGardenSlots.getOfHome).toHaveBeenCalledWith(9);
			});
		});

		it("gives a plant up to the plant threshold", async () => {
			mockFallback(PlantConstants.GARDENER_FALLBACK_PROBABILITIES.GENERIC_ADVICE);

			const packet = await meetPacket();

			expect(givePlantsToPlayer).toHaveBeenCalledWith(player, {
				plantId: packet.plantId, amount: 1
			});
			expect(packet).toEqual(expect.objectContaining({
				interactionName: GARDENER_INTERACTIONS.PLANT, conditionKey: SEED_CONDITION_FAILURE.NONE
			}));
			expect(packet.sentToHomeStorage).toBeUndefined();
		});

		it("tells a player without room for the plant", async () => {
			mockFallback(PlantConstants.GARDENER_FALLBACK_PROBABILITIES.PLANT - 0.01);
			vi.mocked(givePlantsToPlayer).mockResolvedValue({
				delivered: false, reason: "plantSlotsFull" as never
			});

			expect(await meetPacket()).toMatchObject({
				interactionName: GARDENER_INTERACTIONS.ADVICE, conditionKey: SEED_CONDITION_FAILURE.NO_PLANT_SPACE
			});
		});

		it("gives a material on the highest rolls, uncommon when no common one exists", async () => {
			mockFallback(PlantConstants.GARDENER_FALLBACK_PROBABILITIES.PLANT);
			vi.spyOn(MaterialDataController.instance, "getRandomMaterialFromRarity").mockImplementation(rarity => (rarity === MaterialRarity.UNCOMMON ? { id: "8" } : undefined) as never);

			const { response } = await meet();

			expect(gardenerPacket(response)).toMatchObject({
				interactionName: GARDENER_INTERACTIONS.MATERIAL, conditionKey: SEED_CONDITION_FAILURE.NONE, materialId: 8
			});
			expect(updateCollectMaterialsMission).toHaveBeenCalledWith(player, response, [{
				materialId: 8, quantity: 1
			}]);
		});

		it("only gives advice when no material exists", async () => {
			mockFallback(PlantConstants.GARDENER_FALLBACK_PROBABILITIES.PLANT);
			vi.spyOn(MaterialDataController.instance, "getRandomMaterialFromRarity").mockReturnValue(undefined);

			const { response } = await meet();

			expect(packetsOf(response, SmallEventGardenerPacket)[0]).toMatchObject({
				interactionName: GARDENER_INTERACTIONS.ADVICE, conditionKey: SEED_CONDITION_FAILURE.ALL_SEEDS_OBTAINED
			});
			expect(applyMaterialLoot).not.toHaveBeenCalled();
		});
	});
});
