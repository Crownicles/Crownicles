import { SmallEventFuncs } from "../../data/SmallEvent";
import { Maps } from "../maps/Maps";
import { MapLinkDataController } from "../../data/MapLink";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { SmallEventGardenerPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventGardenerPacket";
import { PlayerSmallEvents } from "../database/game/models/PlayerSmallEvent";
import { SmallEventConstants } from "../../../../Lib/src/constants/SmallEventConstants";
import {
	PlantConstants, PlantId,
	SeedConditionKey, SEED_CONDITION_SUCCESS, SEED_CONDITION_FAILURE
} from "../../../../Lib/src/constants/PlantConstants";
import { TimeConstants } from "../../../../Lib/src/constants/TimeConstants";
import {
	PlayerPlantSlots
} from "../database/game/models/PlayerPlantSlot";
import { InventoryInfos } from "../database/game/models/InventoryInfo";
import {
	Home, Homes
} from "../database/game/models/Home";
import { HomeGardenSlots } from "../database/game/models/HomeGardenSlot";
import {
	PetEntities, PetEntity
} from "../database/game/models/PetEntity";
import {
	PetDataController
} from "../../data/Pet";
import { PetConstants } from "../../../../Lib/src/constants/PetConstants";
import { ClassConstants } from "../../../../Lib/src/constants/ClassConstants";
import { InventorySlots } from "../database/game/models/InventorySlot";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import Player from "../database/game/models/Player";
import { MaterialDataController } from "../../data/Material";
import { Materials } from "../database/game/models/Material";
import { MaterialRarity } from "../../../../Lib/src/types/MaterialRarity";
import {
	EndCallback, ReactionCollectorInstance
} from "../utils/ReactionsCollector";
import { ReactionCollectorGardener } from "../../../../Lib/src/packets/interaction/ReactionCollectorGardener";
import { ReactionCollectorAcceptReaction } from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import { BlockingUtils } from "../utils/BlockingUtils";
import { ItemRarity } from "../../../../Lib/src/constants/ItemConstants";

const GARDENER_INTERACTIONS = {
	SEED: "seed",
	ADVICE: "advice",
	PLANT: "plant",
	MATERIAL: "material"
} as const;

const FALLBACK_PROBABILITIES = {
	ADVICE: 0.4,
	PLANT: 0.8
};

const LUNAR_CYCLE_DAYS = 29.53058770576;
const REFERENCE_NEW_MOON = new Date(2000, 0, 6, 18, 14, 0).getTime();
const GAME_TIMEZONE = "Europe/Paris";
const NIGHT_THRESHOLDS = {
	EVENING: 21,
	MORNING: 6
};

function getMoonIllumination(): number {
	const daysSinceNewMoon = (Date.now() - REFERENCE_NEW_MOON) / TimeConstants.MS_TIME.DAY;
	const phase = (daysSinceNewMoon % LUNAR_CYCLE_DAYS) / LUNAR_CYCLE_DAYS;
	return (1 - Math.cos(2 * Math.PI * phase)) / 2;
}

function getGameHour(): number {
	const formatter = new Intl.DateTimeFormat("fr-FR", {
		timeZone: GAME_TIMEZONE,
		hour: "numeric",
		hour12: false
	});
	return parseInt(formatter.format(new Date()), 10);
}

function isNight(): boolean {
	const hour = getGameHour();
	return hour >= NIGHT_THRESHOLDS.EVENING || hour < NIGHT_THRESHOLDS.MORNING;
}

function isOnGardenerMapLink(mapLinkId: number): boolean {
	const link = MapLinkDataController.instance.getById(mapLinkId);
	if (!link) {
		return false;
	}
	return PlantConstants.GARDENER_MAP_LINKS.includes(Number(link.id));
}

/**
 * Determine the next seed the player can receive.
 * Returns the PlantId or null if no seed is available.
 */
async function getNextSeedId(player: Player, home: Home | null): Promise<PlantId | null> {
	const invInfo = await InventoryInfos.getOfPlayer(player.id);
	await PlayerPlantSlots.initializeSlots(player.id, invInfo.plantSlots);

	if (await playerHasSeed(player.id)) {
		return null;
	}

	if (!hasGarden(home)) {
		return PlantId.COMMON_HERB;
	}

	const highestPlanted = await getHighestPlantedSeedId(home!.id);
	const nextSeed = highestPlanted + 1;
	return nextSeed > 10 ? null : nextSeed as PlantId;
}

type SeedConditionResult = {
	canObtain: boolean;
	conditionKey: SeedConditionKey;
};

type SeedConditionChecker = (player: Player) => Promise<SeedConditionResult>;

function hasGarden(home: Home | null): boolean {
	return (home?.getLevel()?.features.gardenPlots ?? 0) > 0;
}

async function playerHasSeed(playerId: number): Promise<boolean> {
	const seedSlot = await PlayerPlantSlots.getSeedSlot(playerId);
	return seedSlot !== null && seedSlot.plantId !== 0;
}

async function getHighestPlantedSeedId(homeId: number): Promise<number> {
	const gardenSlots = await HomeGardenSlots.getOfHome(homeId);
	return gardenSlots.reduce((highestPlanted, slot) => Math.max(highestPlanted, slot.plantId), 0);
}

function getDefaultSeedCondition(cost: number): SeedConditionResult {
	return {
		canObtain: true,
		conditionKey: cost > 0 ? SEED_CONDITION_SUCCESS.PAID : SEED_CONDITION_SUCCESS.FREE
	};
}

function getNightSeedCondition(seedId: PlantId): SeedConditionResult {
	if (seedId === PlantId.LUNAR_MOSS) {
		return !isNight() || getMoonIllumination() <= 0.5
			? {
				canObtain: false,
				conditionKey: SEED_CONDITION_FAILURE.NEED_MOONLIGHT
			}
			: {
				canObtain: true,
				conditionKey: SEED_CONDITION_SUCCESS.MOON
			};
	}

	return !isNight()
		? {
			canObtain: false,
			conditionKey: SEED_CONDITION_FAILURE.NEED_NIGHT
		}
		: {
			canObtain: true,
			conditionKey: SEED_CONDITION_SUCCESS.NIGHT
		};
}

function getSpecialSeedChecker(seedId: PlantId): SeedConditionChecker | null {
	switch (seedId) {
		case PlantId.LUNAR_MOSS:
		case PlantId.NIGHT_MUSHROOM:
			return (): Promise<SeedConditionResult> => Promise.resolve(getNightSeedCondition(seedId));
		case PlantId.VENOMOUS_LEAF:
			return async (player: Player): Promise<SeedConditionResult> => await checkHerbivorePetCondition(player, false);
		case PlantId.FIRE_BULB:
			return async (player: Player): Promise<SeedConditionResult> => await checkFireAffinityCondition(player);
		case PlantId.MEAT_PLANT:
			return async (player: Player): Promise<SeedConditionResult> => await checkCarnivorePetCondition(player);
		case PlantId.ANCIENT_TREE:
			return async (player: Player): Promise<SeedConditionResult> => await checkHerbivorePetCondition(player, true);
		default:
			return null;
	}
}

async function getOwnedPet(player: Player): Promise<PetEntity | null> {
	return player.petId ? await PetEntities.getById(player.petId) : null;
}

function isHerbivorePetEligible(petEntity: PetEntity, requireLegendary: boolean): boolean {
	const petData = PetDataController.instance.getById(petEntity.typeId);
	if (!petData) {
		return false;
	}

	const isHerbivore = petData.canEatVegetables();
	const isTrained = petEntity.lovePoints >= PetConstants.TRAINED_LOVE_THRESHOLD;
	const meetsRarityRequirement = !requireLegendary || petData.rarity >= ItemRarity.EPIC;

	return isHerbivore && isTrained && meetsRarityRequirement;
}

async function checkSeedConditions(player: Player, seedId: PlantId, home: Home | null): Promise<SeedConditionResult> {
	if (player.level < PlantConstants.SEED_LEVEL_REQUIREMENTS[seedId]) {
		return {
			canObtain: false,
			conditionKey: SEED_CONDITION_FAILURE.NEED_LEVEL
		};
	}

	if (seedId > PlantId.COMMON_HERB && !hasGarden(home)) {
		return {
			canObtain: false,
			conditionKey: SEED_CONDITION_FAILURE.NEED_GARDEN
		};
	}

	const cost = PlantConstants.SEED_COSTS[seedId];
	if (cost > 0 && player.money < cost) {
		return {
			canObtain: false,
			conditionKey: SEED_CONDITION_FAILURE.NEED_MONEY
		};
	}

	const specialChecker = getSpecialSeedChecker(seedId);
	if (specialChecker) {
		return await specialChecker(player);
	}

	return getDefaultSeedCondition(cost);
}

async function checkHerbivorePetCondition(player: Player, requireLegendary: boolean): Promise<SeedConditionResult> {
	const failKey = requireLegendary ? SEED_CONDITION_FAILURE.NEED_LEGENDARY_HERBIVORE_PET : SEED_CONDITION_FAILURE.NEED_HERBIVORE_PET;

	const petEntity = await getOwnedPet(player);
	if (!petEntity || !isHerbivorePetEligible(petEntity, requireLegendary)) {
		return {
			canObtain: false,
			conditionKey: failKey
		};
	}

	return {
		canObtain: true,
		conditionKey: requireLegendary ? SEED_CONDITION_SUCCESS.LEGENDARY_HERBIVORE_PET : SEED_CONDITION_SUCCESS.HERBIVORE_PET
	};
}

async function checkFireAffinityCondition(player: Player): Promise<SeedConditionResult> {
	if (player.class === ClassConstants.CLASSES_ID.MYSTIC_MAGE) {
		return {
			canObtain: true,
			conditionKey: SEED_CONDITION_SUCCESS.MAGE
		};
	}

	if (player.petId) {
		const petEntity = await PetEntities.getById(player.petId);
		if (petEntity && petEntity.typeId === PetConstants.PETS.PHOENIX) {
			return {
				canObtain: true,
				conditionKey: SEED_CONDITION_SUCCESS.PHOENIX
			};
		}
	}

	const fireItemChecks: {
		slot: { itemId: number } | null; fireIds: readonly number[];
	}[] = [
		{
			slot: await InventorySlots.getMainWeaponSlot(player.id), fireIds: PlantConstants.FIRE_ITEM_IDS.WEAPONS
		},
		{
			slot: await InventorySlots.getMainArmorSlot(player.id), fireIds: PlantConstants.FIRE_ITEM_IDS.ARMORS
		},
		{
			slot: await InventorySlots.getMainObjectSlot(player.id), fireIds: PlantConstants.FIRE_ITEM_IDS.OBJECTS
		}
	];

	for (const {
		slot, fireIds
	} of fireItemChecks) {
		if (slot && fireIds.includes(slot.itemId)) {
			return {
				canObtain: true,
				conditionKey: SEED_CONDITION_SUCCESS.FIRE_ITEM
			};
		}
	}

	return {
		canObtain: false,
		conditionKey: SEED_CONDITION_FAILURE.NEED_FIRE_AFFINITY
	};
}

async function checkCarnivorePetCondition(player: Player): Promise<SeedConditionResult> {
	const petEntity = player.petId ? await PetEntities.getById(player.petId) : null;
	if (!petEntity) {
		return {
			canObtain: false,
			conditionKey: SEED_CONDITION_FAILURE.NEED_CARNIVORE_PET
		};
	}

	const petData = PetDataController.instance.getById(petEntity.typeId);
	if (!petData || !petData.canEatMeat()) {
		return {
			canObtain: false,
			conditionKey: SEED_CONDITION_FAILURE.NEED_CARNIVORE_PET
		};
	}

	if (petData.rarity < ItemRarity.EPIC) {
		return {
			canObtain: false,
			conditionKey: SEED_CONDITION_FAILURE.NEED_CARNIVORE_PET
		};
	}

	return {
		canObtain: true,
		conditionKey: SEED_CONDITION_SUCCESS.CARNIVORE_PET
	};
}

async function giveSeedToPlayer(response: CrowniclesPacket[], player: Player, seedId: PlantId, conditionKey: SeedConditionKey): Promise<SmallEventGardenerPacket> {
	const cost = PlantConstants.SEED_COSTS[seedId];

	if (cost > 0) {
		await player.spendMoney({
			amount: cost,
			response,
			reason: NumberChangeReason.SMALL_EVENT
		});
		await player.save();
	}

	await PlayerPlantSlots.setSeed(player.id, seedId);

	return {
		interactionName: GARDENER_INTERACTIONS.SEED,
		plantId: seedId,
		materialId: 0,
		cost,
		conditionKey
	};
}

function getPaidSeedEndCallback(player: Player, seedId: PlantId, _conditionKey: SeedConditionKey): EndCallback {
	return async (collector, response): Promise<void> => {
		const reaction = collector.getFirstReaction();

		if (reaction && reaction.reaction.type === ReactionCollectorAcceptReaction.name) {
			const cost = PlantConstants.SEED_COSTS[seedId];
			if (player.money >= cost) {
				const packet = await giveSeedToPlayer(response, player, seedId, SEED_CONDITION_SUCCESS.PAID_ACCEPTED);
				response.push(makePacket(SmallEventGardenerPacket, packet));
			}
			else {
				response.push(makePacket(SmallEventGardenerPacket, {
					interactionName: GARDENER_INTERACTIONS.ADVICE,
					plantId: seedId,
					materialId: 0,
					cost: 0,
					conditionKey: SEED_CONDITION_FAILURE.NEED_MONEY
				}));
			}
		}
		else {
			response.push(makePacket(SmallEventGardenerPacket, {
				interactionName: GARDENER_INTERACTIONS.ADVICE,
				plantId: seedId,
				materialId: 0,
				cost: 0,
				conditionKey: SEED_CONDITION_FAILURE.REFUSED
			}));
		}

		BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.GARDENER_SMALL_EVENT);
	};
}

async function handleFallback(response: CrowniclesPacket[], player: Player, conditionKey: SeedConditionKey, targetSeedId: PlantId | 0 = 0): Promise<SmallEventGardenerPacket> {
	const roll = RandomUtils.crowniclesRandom.real(0, 1);

	if (roll < FALLBACK_PROBABILITIES.ADVICE) {
		return {
			interactionName: GARDENER_INTERACTIONS.ADVICE,
			plantId: targetSeedId,
			materialId: 0,
			cost: 0,
			conditionKey
		};
	}

	if (roll < FALLBACK_PROBABILITIES.PLANT) {
		return await handlePlantGift(player);
	}

	return await handleMaterialGift(response, player);
}

async function handlePlantGift(player: Player): Promise<SmallEventGardenerPacket> {
	const emptySlot = await PlayerPlantSlots.findEmptyPlantSlot(player.id);

	if (emptySlot) {
		const randomPlantId = PlantConstants.lootRandomPlant(RandomUtils.crowniclesRandom);
		await PlayerPlantSlots.setPlant(player.id, emptySlot.slot, randomPlantId);
		return {
			interactionName: GARDENER_INTERACTIONS.PLANT,
			plantId: randomPlantId,
			materialId: 0,
			cost: 0,
			conditionKey: SEED_CONDITION_FAILURE.NONE
		};
	}

	return {
		interactionName: GARDENER_INTERACTIONS.ADVICE,
		plantId: 0,
		materialId: 0,
		cost: 0,
		conditionKey: SEED_CONDITION_FAILURE.NO_PLANT_SPACE
	};
}

async function handleMaterialGift(_response: CrowniclesPacket[], player: Player): Promise<SmallEventGardenerPacket> {
	const material = MaterialDataController.instance.getRandomMaterialFromRarity(MaterialRarity.COMMON)
		?? MaterialDataController.instance.getRandomMaterialFromRarity(MaterialRarity.UNCOMMON);

	if (material) {
		await Materials.giveMaterial(player.id, parseInt(material.id, 10), 1);
		return {
			interactionName: GARDENER_INTERACTIONS.MATERIAL,
			plantId: 0,
			materialId: parseInt(material.id, 10),
			cost: 0,
			conditionKey: SEED_CONDITION_FAILURE.NONE
		};
	}

	return {
		interactionName: GARDENER_INTERACTIONS.ADVICE,
		plantId: 0,
		materialId: 0,
		cost: 0,
		conditionKey: SEED_CONDITION_FAILURE.ALL_SEEDS_OBTAINED
	};
}

export const smallEventFuncs: SmallEventFuncs = {
	canBeExecuted: async player => {
		if (!Maps.isOnContinent(player)) {
			return false;
		}
		if (!isOnGardenerMapLink(player.mapLinkId)) {
			return false;
		}
		return await PlayerSmallEvents.playerSmallEventCount(player.id, SmallEventConstants.UNIQUE_EVENT_IDS.GARDENER) === 0;
	},
	executeSmallEvent: async (response: CrowniclesPacket[], player, context: PacketContext): Promise<void> => {
		const home = await Homes.getOfPlayer(player.id);
		const nextSeedId = await getNextSeedId(player, home);

		if (nextSeedId === null) {
			const seedSlot = await PlayerPlantSlots.getSeedSlot(player.id);
			const conditionKey = seedSlot && seedSlot.plantId !== 0 ? SEED_CONDITION_FAILURE.SEED_SLOT_FULL : SEED_CONDITION_FAILURE.ALL_SEEDS_OBTAINED;
			const packet = await handleFallback(response, player, conditionKey);
			response.push(makePacket(SmallEventGardenerPacket, packet));
			return;
		}

		const conditions = await checkSeedConditions(player, nextSeedId, home);

		if (!conditions.canObtain) {
			const packet = await handleFallback(response, player, conditions.conditionKey, nextSeedId);
			response.push(makePacket(SmallEventGardenerPacket, packet));
			return;
		}

		const cost = PlantConstants.SEED_COSTS[nextSeedId];

		if (cost > 0) {
			const collector = new ReactionCollectorGardener(nextSeedId, cost, conditions.conditionKey);
			const collectorPacket = new ReactionCollectorInstance(
				collector,
				context,
				{
					allowedPlayerKeycloakIds: [player.keycloakId]
				},
				getPaidSeedEndCallback(player, nextSeedId, conditions.conditionKey)
			)
				.block(player.keycloakId, BlockingConstants.REASONS.GARDENER_SMALL_EVENT)
				.build();
			response.push(collectorPacket);
		}
		else {
			const packet = await giveSeedToPlayer(response, player, nextSeedId, conditions.conditionKey);
			response.push(makePacket(SmallEventGardenerPacket, packet));
		}
	}
};
