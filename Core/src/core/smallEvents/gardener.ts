/* @lockInherited — body runs under loadAndExecuteSmallEvents withLockedPlayerAndMissions callback. */
import { SmallEventFuncs } from "../../data/SmallEvent";
import { Maps } from "../maps/Maps";
import { MapLinkDataController } from "../../data/MapLink";
import { MapLocationDataController } from "../../data/MapLocation";
import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	GardenerConsolation, SmallEventGardenerPacket
} from "../../../../Lib/src/packets/smallEvents/SmallEventGardenerPacket";
import { PlayerSmallEvents } from "../database/game/models/PlayerSmallEvent";
import { SmallEventConstants } from "../../../../Lib/src/constants/SmallEventConstants";
import {
	GARDENER_ADVICE, GARDENER_INTERACTIONS, PLANT_TYPES, PlantConstants, PlantId,
	SeedConditionKey, SEED_CONDITION_SUCCESS, SEED_CONDITION_FAILURE
} from "../../../../Lib/src/constants/PlantConstants";
import { TimeConstants } from "../../../../Lib/src/constants/TimeConstants";
import {
	PlayerPlantSlot, PlayerPlantSlots
} from "../database/game/models/PlayerPlantSlot";
import { InventoryInfos } from "../database/game/models/InventoryInfo";
import {
	Home, Homes
} from "../database/game/models/Home";
import {
	HomeGardenSlot, HomeGardenSlots
} from "../database/game/models/HomeGardenSlot";
import {
	PetEntities, PetEntity
} from "../database/game/models/PetEntity";
import {
	PetDataController
} from "../../data/Pet";
import {
	PetConstants, PetTag
} from "../../../../Lib/src/constants/PetConstants";
import { ClassConstants } from "../../../../Lib/src/constants/ClassConstants";
import { InventorySlots } from "../database/game/models/InventorySlot";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import Player from "../database/game/models/Player";
import { MaterialDataController } from "../../data/Material";
import {
	applyMaterialLoot, updateCollectMaterialsMission
} from "../utils/MaterialLootUtils";
import { MaterialRarity } from "../../../../Lib/src/types/MaterialRarity";
import {
	EndCallback, ReactionCollectorInstance
} from "../utils/ReactionsCollector";
import { withLockedPlayerAndMissionsSafe } from "../utils/withLockedPlayerAndMissionsSafe";
import { ReactionCollectorGardener } from "../../../../Lib/src/packets/interaction/ReactionCollectorGardener";
import { ReactionCollectorAcceptReaction } from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import { BlockingUtils } from "../utils/BlockingUtils";
import { ItemConstants } from "../../../../Lib/src/constants/ItemConstants";
import { GardenConstants } from "../../../../Lib/src/constants/GardenConstants";
import { GardenEarthQuality } from "../../../../Lib/src/types/GardenEarthQuality";
import { HomeLevel } from "../../../../Lib/src/types/HomeLevel";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";
import { LogsReadRequests } from "../database/logs/LogsReadRequests";
import { MapLocationConstants } from "../../../../Lib/src/constants/MapLocationConstants";
import {
	getPlantReceiverLockKeys, givePlantsToPlayer
} from "../utils/PlantDeliveryUtils";

function makeGardenerPacket(packet: Partial<SmallEventGardenerPacket> & Pick<SmallEventGardenerPacket, "interactionName" | "conditionKey">): SmallEventGardenerPacket {
	return {
		interactionName: packet.interactionName,
		plantId: packet.plantId ?? 0,
		materialId: packet.materialId ?? 0,
		cost: packet.cost ?? 0,
		conditionKey: packet.conditionKey,

		/*
		 * Only the initial-render path (executeSmallEvent direct push) sets this
		 * to a meaningful value — every other call site (post-collector callbacks)
		 * leaves it unset because Discord skips the story for those (#4273).
		 */
		...packet.isFirstEncounter !== undefined ? { isFirstEncounter: packet.isFirstEncounter } : {},
		...packet.sentToHomeStorage ? { sentToHomeStorage: true } : {},
		...packet.consolation ? { consolation: packet.consolation } : {}
	};
}

type GardenerPlantGift = Extract<GardenerConsolation, { plantId: PlantId }>;

let moonCache: {
	illumination: number; fetchedAt: number;
} | null = null;

const RADIANS_PER_DEGREE = Math.PI / 180;

function getFallbackMoonIllumination(): number {
	const daysSinceNewMoon = (Date.now() - PlantConstants.LUNAR_FALLBACK.REFERENCE_NEW_MOON) / TimeConstants.MS_TIME.DAY;
	const phase = (daysSinceNewMoon % PlantConstants.LUNAR_FALLBACK.CYCLE_DAYS) / PlantConstants.LUNAR_FALLBACK.CYCLE_DAYS;
	return (1 - Math.cos(2 * Math.PI * phase)) / 2;
}

function buildMoonApiUrl(now: Date): string {
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1)
		.padStart(2, "0");
	const day = String(now.getDate())
		.padStart(2, "0");
	const today = `${year}-${month}-${day}`;

	const timezoneOffsetMinutes = -now.getTimezoneOffset();
	const offsetSign = timezoneOffsetMinutes >= 0 ? "+" : "-";
	const absMinutes = Math.abs(timezoneOffsetMinutes);
	const offsetHours = String(Math.floor(absMinutes / 60))
		.padStart(2, "0");
	const offsetMins = String(absMinutes % 60)
		.padStart(2, "0");
	const offset = `${offsetSign}${offsetHours}:${offsetMins}`;

	return `${PlantConstants.MOON_API.BASE_URL}?lat=${PlantConstants.MOON_API.LAT}&lon=${PlantConstants.MOON_API.LON}&date=${today}&offset=${offset}`;
}

/**
 * Fetch the current moon phase in degrees, or null when the API answers with an error or an unexpected payload
 */
async function fetchMoonPhase(): Promise<number | null> {
	const response = await fetch(buildMoonApiUrl(new Date()), {
		headers: { "User-Agent": PlantConstants.MOON_API.USER_AGENT }
	});

	if (!response.ok) {
		// An unread body keeps its connection and buffers alive
		await response.body?.cancel();
		CrowniclesLogger.error("Moon API returned non-OK status", { status: response.status });
		return null;
	}

	const data = await response.json() as { properties?: { moonphase?: number } };
	const moonphase = data.properties?.moonphase;
	if (typeof moonphase !== "number") {
		CrowniclesLogger.error("Moon API returned unexpected data format");
		return null;
	}
	return moonphase;
}

async function getMoonIllumination(): Promise<number> {
	if (moonCache && Date.now() - moonCache.fetchedAt < PlantConstants.MOON_API.CACHE_DURATION) {
		return moonCache.illumination;
	}

	try {
		const moonphase = await fetchMoonPhase();
		if (moonphase === null) {
			return getFallbackMoonIllumination();
		}

		const illumination = (1 - Math.cos(moonphase * RADIANS_PER_DEGREE)) / 2;
		moonCache = {
			illumination,
			fetchedAt: Date.now()
		};
		return illumination;
	}
	catch (e) {
		CrowniclesLogger.errorWithObj("Failed to fetch moon phase from API", e);
		return getFallbackMoonIllumination();
	}
}

function getGameHour(): number {
	return new Date().getHours();
}

function isNight(): boolean {
	const hour = getGameHour();
	return hour >= PlantConstants.NIGHT_THRESHOLDS.EVENING || hour < PlantConstants.NIGHT_THRESHOLDS.MORNING;
}

function isOnGardenerMapLink(mapLinkId: number): boolean {
	const link = MapLinkDataController.instance.getById(mapLinkId);
	if (!link) {
		return false;
	}

	const startLocation = MapLocationDataController.instance.getById(link.startMap);
	const endLocation = MapLocationDataController.instance.getById(link.endMap);

	return startLocation?.type === MapLocationConstants.TYPES.FOREST || endLocation?.type === MapLocationConstants.TYPES.FOREST;
}

/**
 * Determine the next seed the player can receive.
 * Returns the PlantId or null if no seed is available.
 */
async function getNextSeedId(player: Player, home: Home | null): Promise<PlantId | null> {
	const invInfo = await InventoryInfos.getOfPlayer(player.id);
	await PlayerPlantSlots.initializeSlots(player.id, invInfo.plantSlots);
	return await findNextSeedId(player.id, home);
}

/**
 * Read-only part of {@link getNextSeedId}, for the checks made outside the small event lock
 */
async function findNextSeedId(playerId: number, home: Home | null): Promise<PlantId | null> {
	if (await playerHasSeed(playerId)) {
		return null;
	}

	if (!hasGarden(home)) {
		return PlantId.COMMON_HERB;
	}

	const highestPlanted = await HomeGardenSlots.getHighestPlantedId(home!.id);
	const nextSeed = highestPlanted + 1;
	return nextSeed > PlantConstants.MAX_PLANT_ID ? null : nextSeed as PlantId;
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

function getDefaultSeedCondition(cost: number): SeedConditionResult {
	return {
		canObtain: true,
		conditionKey: cost > 0 ? SEED_CONDITION_SUCCESS.PAID : SEED_CONDITION_SUCCESS.FREE
	};
}

/**
 * One of the ways to earn a seed whose condition can be fulfilled in several ways
 */
type SeedFavor = {
	conditionKey: SeedConditionKey;
	isGranted: (player: Player) => boolean | Promise<boolean>;
};

/**
 * The seed is handed over as soon as one of its favors is granted, the favors being checked in order
 */
async function checkSeedFavors(player: Player, favors: SeedFavor[], failureKey: SeedConditionKey): Promise<SeedConditionResult> {
	for (const favor of favors) {
		if (await favor.isGranted(player)) {
			return {
				canObtain: true,
				conditionKey: favor.conditionKey
			};
		}
	}
	return {
		canObtain: false,
		conditionKey: failureKey
	};
}

async function hasPetWithTag(player: Player, tag: PetTag): Promise<boolean> {
	const petEntity = await getOwnedPet(player);
	return Boolean(petEntity && PetDataController.instance.getById(petEntity.typeId)?.hasTag(tag));
}

async function hasSleptInInnRecently(player: Player): Promise<boolean> {
	return await LogsReadRequests.hasSleptInInnDuringLast(player.keycloakId, PlantConstants.INN_NIGHT_FAVOR_DURATION);
}

async function isMoonlitNight(): Promise<boolean> {
	return isNight() && await getMoonIllumination() > PlantConstants.MOON_ILLUMINATION_THRESHOLD;
}

const INN_NIGHT_FAVOR: SeedFavor = {
	conditionKey: SEED_CONDITION_SUCCESS.INN_NIGHT,
	isGranted: hasSleptInInnRecently
};

/**
 * The lunar moss grows on the highest rocks lit by the moon: a flying pet picks it, or the player watched the moon from an inn, or meets the gardener under it
 */
const LUNAR_MOSS_FAVORS: SeedFavor[] = [
	{
		conditionKey: SEED_CONDITION_SUCCESS.FLYING_PET,
		isGranted: player => hasPetWithTag(player, PetConstants.TAGS.FLYING)
	},
	INN_NIGHT_FAVOR,
	{
		conditionKey: SEED_CONDITION_SUCCESS.MOON,
		isGranted: isMoonlitNight
	}
];

/**
 * The night mushroom is found in the dark: a nocturnal pet sniffs it out, or the player spent the night in an inn, or meets the gardener at night
 */
const NIGHT_MUSHROOM_FAVORS: SeedFavor[] = [
	{
		conditionKey: SEED_CONDITION_SUCCESS.NOCTURNAL_PET,
		isGranted: player => hasPetWithTag(player, PetConstants.TAGS.NOCTURNAL)
	},
	INN_NIGHT_FAVOR,
	{
		conditionKey: SEED_CONDITION_SUCCESS.NIGHT,
		isGranted: isNight
	}
];

function getSpecialSeedChecker(seedId: PlantId): SeedConditionChecker | null {
	switch (seedId) {
		case PlantId.LUNAR_MOSS:
			return async (player: Player): Promise<SeedConditionResult> => await checkSeedFavors(player, LUNAR_MOSS_FAVORS, SEED_CONDITION_FAILURE.NEED_MOONLIGHT);
		case PlantId.NIGHT_MUSHROOM:
			return async (player: Player): Promise<SeedConditionResult> => await checkSeedFavors(player, NIGHT_MUSHROOM_FAVORS, SEED_CONDITION_FAILURE.NEED_NIGHT);
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
	const meetsRarityRequirement = !requireLegendary || petData.rarity >= PlantConstants.RARE_PET_SEED_MIN_RARITY;

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

async function hasFireAffinityItem(player: Player): Promise<boolean> {
	const equippedSlots = [
		await InventorySlots.getMainWeaponSlot(player.id),
		await InventorySlots.getMainArmorSlot(player.id),
		await InventorySlots.getMainObjectSlot(player.id)
	];
	return equippedSlots.some(slot => slot?.getItem()?.tags?.includes(ItemConstants.TAGS.FIRE));
}

async function checkFireAffinityCondition(player: Player): Promise<SeedConditionResult> {
	if (player.class === ClassConstants.CLASSES_ID.MYSTIC_MAGE) {
		return {
			canObtain: true,
			conditionKey: SEED_CONDITION_SUCCESS.MAGE
		};
	}

	if (await hasPetWithTag(player, PetConstants.TAGS.FIRE)) {
		return {
			canObtain: true,
			conditionKey: SEED_CONDITION_SUCCESS.FIRE_PET
		};
	}

	if (await hasFireAffinityItem(player)) {
		return {
			canObtain: true,
			conditionKey: SEED_CONDITION_SUCCESS.FIRE_ITEM
		};
	}

	return {
		canObtain: false,
		conditionKey: SEED_CONDITION_FAILURE.NEED_FIRE_AFFINITY
	};
}

async function checkCarnivorePetCondition(player: Player): Promise<SeedConditionResult> {
	const petEntity = await getOwnedPet(player);
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

	if (petData.rarity < PlantConstants.RARE_PET_SEED_MIN_RARITY) {
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

	return makeGardenerPacket({
		interactionName: GARDENER_INTERACTIONS.SEED, conditionKey, plantId: seedId, cost
	});
}

function getPaidSeedEndCallback(player: Player, seedId: PlantId): EndCallback {
	return async (collector, response): Promise<void> => {
		BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.GARDENER_SMALL_EVENT);
		await withLockedPlayerAndMissionsSafe(player, "gardener paid seed endCallback", async lockedPlayer => {
			const reaction = collector.getFirstReaction();

			if (reaction && reaction.reaction.type === ReactionCollectorAcceptReaction.name) {
				const cost = PlantConstants.SEED_COSTS[seedId];
				if (lockedPlayer.money >= cost) {
					const packet = await giveSeedToPlayer(response, lockedPlayer, seedId, SEED_CONDITION_SUCCESS.PAID_ACCEPTED);
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
		});
	};
}

function hasReadyToHarvestPlant(gardenSlots: HomeGardenSlot[], earthQuality: GardenEarthQuality): boolean {
	return gardenSlots.some(slot => {
		if (slot.isEmpty() || !slot.plantedAt) {
			return false;
		}
		const plantType = PLANT_TYPES.find(p => p.id === slot.plantId);
		if (!plantType) {
			return false;
		}
		const effectiveGrowth = GardenConstants.getEffectiveGrowthTime(plantType.growthTimeSeconds, earthQuality);
		return slot.isReady(effectiveGrowth);
	});
}

function hasNoGardenFeature(homeLevel: HomeLevel | null): boolean {
	return !homeLevel || homeLevel.features.gardenPlots === 0;
}

function hasUnplantedSeed(seedSlot: PlayerPlantSlot | null): boolean {
	return seedSlot !== null && seedSlot.plantId !== 0;
}

async function getGenericAdviceKey(player: Player): Promise<SeedConditionKey> {
	const home = await Homes.getOfPlayer(player.id);

	if (!home) {
		return GARDENER_ADVICE.TIP_BUY_HOME;
	}

	const homeLevel = home.getLevel();
	if (hasNoGardenFeature(homeLevel)) {
		return GARDENER_ADVICE.TIP_UPGRADE_FOR_GARDEN;
	}

	// Check if player has an unplanted seed
	const invInfo = await InventoryInfos.getOfPlayer(player.id);
	await PlayerPlantSlots.initializeSlots(player.id, invInfo.plantSlots);
	const seedSlot = await PlayerPlantSlots.getSeedSlot(player.id);
	if (hasUnplantedSeed(seedSlot)) {
		return GARDENER_ADVICE.TIP_PLANT_SEED;
	}

	// Check if any plant is ready to harvest
	const gardenSlots = await HomeGardenSlots.getOfHome(home.id);
	const earthQuality = homeLevel!.features.gardenEarthQuality;
	if (hasReadyToHarvestPlant(gardenSlots, earthQuality)) {
		return GARDENER_ADVICE.TIP_HARVEST_READY;
	}

	// Check if garden has empty plots and player could plant
	if (gardenSlots.some(s => s.isEmpty())) {
		return GARDENER_ADVICE.TIP_EMPTY_PLOTS;
	}

	// Check if soil quality is poor
	if (earthQuality === GardenEarthQuality.POOR) {
		return GARDENER_ADVICE.TIP_UPGRADE_SOIL;
	}

	return GARDENER_ADVICE.TIP_GENERIC;
}

async function handleFallback(response: CrowniclesPacket[], player: Player, conditionKey: SeedConditionKey): Promise<SmallEventGardenerPacket> {
	const roll = RandomUtils.crowniclesRandom.real(0, 1);

	if (roll < PlantConstants.GARDENER_FALLBACK_PROBABILITIES.ADVICE) {
		return makeGardenerPacket({
			interactionName: GARDENER_INTERACTIONS.ADVICE, conditionKey
		});
	}

	if (roll < PlantConstants.GARDENER_FALLBACK_PROBABILITIES.GENERIC_ADVICE) {
		const genericKey = await getGenericAdviceKey(player);
		return makeGardenerPacket({
			interactionName: GARDENER_INTERACTIONS.ADVICE, conditionKey: genericKey
		});
	}

	if (roll < PlantConstants.GARDENER_FALLBACK_PROBABILITIES.PLANT) {
		return await handlePlantGift(player);
	}

	return await handleMaterialGift(response, player);
}

/**
 * Give a random plant of the gardener to the player, or null when the player has no room for it
 */
async function giveGardenerPlant(player: Player): Promise<GardenerPlantGift | null> {
	const plantId = PlantConstants.lootRandomPlant(RandomUtils.crowniclesRandom);
	const delivery = await givePlantsToPlayer(player, {
		plantId,
		amount: 1
	});
	return delivery.delivered
		? {
			plantId,
			sentToHomeStorage: delivery.toHomeStorage > 0
		}
		: null;
}

/**
 * Give a common (or else uncommon) material to the player, or null when there is none to give
 */
async function giveGardenerMaterial(response: CrowniclesPacket[], player: Player): Promise<number | null> {
	const material = MaterialDataController.instance.getRandomMaterialFromRarity(MaterialRarity.COMMON)
		?? MaterialDataController.instance.getRandomMaterialFromRarity(MaterialRarity.UNCOMMON);
	if (!material) {
		return null;
	}
	const materialId = parseInt(material.id, 10);
	const loot = [
		{
			materialId,
			quantity: 1
		}
	];
	await applyMaterialLoot(player.id, loot);
	await updateCollectMaterialsMission(player, response, loot);
	return materialId;
}

// Exported for integration tests
export async function handlePlantGift(player: Player): Promise<SmallEventGardenerPacket> {
	const gift = await giveGardenerPlant(player);
	if (!gift) {
		return makeGardenerPacket({
			interactionName: GARDENER_INTERACTIONS.ADVICE, conditionKey: SEED_CONDITION_FAILURE.NO_PLANT_SPACE
		});
	}
	return makeGardenerPacket({
		interactionName: GARDENER_INTERACTIONS.PLANT,
		conditionKey: SEED_CONDITION_FAILURE.NONE,
		...gift
	});
}

async function handleMaterialGift(response: CrowniclesPacket[], player: Player): Promise<SmallEventGardenerPacket> {
	const materialId = await giveGardenerMaterial(response, player);
	return materialId === null
		? makeGardenerPacket({
			interactionName: GARDENER_INTERACTIONS.ADVICE, conditionKey: SEED_CONDITION_FAILURE.ALL_SEEDS_OBTAINED
		})
		: makeGardenerPacket({
			interactionName: GARDENER_INTERACTIONS.MATERIAL, conditionKey: SEED_CONDITION_FAILURE.NONE, materialId
		});
}

/**
 * Gift added to the explanation of a blocked seed: a plant most of the time, a material when the draw says so or when the player has no room for a plant
 */
async function giveConsolation(response: CrowniclesPacket[], player: Player): Promise<GardenerConsolation | null> {
	const plantGift = RandomUtils.crowniclesRandom.bool(PlantConstants.GARDENER_CONSOLATION_PLANT_PROBABILITY)
		? await giveGardenerPlant(player)
		: null;
	if (plantGift) {
		return plantGift;
	}
	const materialId = await giveGardenerMaterial(response, player);
	return materialId === null ? null : { materialId };
}

/**
 * Seed the gardener cannot hand over, and why (0 when the player still carries a seed to plant)
 */
type BlockedSeed = {
	conditionKey: SeedConditionKey;
	seedId: PlantId | 0;
};

/**
 * The gardener cannot hand over the next seed: he always explains what is missing, and gives a consolation gift so that the encounter is never wasted
 */
async function explainBlockedSeed(response: CrowniclesPacket[], player: Player, blockedSeed: BlockedSeed): Promise<SmallEventGardenerPacket> {
	const consolation = await giveConsolation(response, player);
	return makeGardenerPacket({
		interactionName: GARDENER_INTERACTIONS.ADVICE,
		conditionKey: blockedSeed.conditionKey,
		plantId: blockedSeed.seedId,
		...consolation ? { consolation } : {}
	});
}

/**
 * The gardener is guaranteed on a forest path to a player who fulfills the conditions of their next seed: a player who
 * prepared the right pet is not left at the mercy of the draw. The small event being eligible already means the path is
 * a forest one and the gardener did not appear on it yet.
 */
async function isGardenerGuaranteed(player: Player): Promise<boolean> {
	const home = await Homes.getOfPlayer(player.id);
	const nextSeedId = await findNextSeedId(player.id, home);
	return nextSeedId !== null && (await checkSeedConditions(player, nextSeedId, home)).canObtain;
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
	executeSmallEvent: async (player, {
		response, context
	}): Promise<void> => {
		const home = await Homes.getOfPlayer(player.id);
		const nextSeedId = await getNextSeedId(player, home);

		/*
		 * `logSmallEvent` is called by the ReportSmallEvent flow BEFORE this
		 * function runs, so the count already includes the current encounter:
		 * `<= 1` means "no prior encounter on record" (#4273).
		 */
		const isFirstEncounter = await LogsReadRequests.getSmallEventEncounterCount(
			player.keycloakId, SmallEventConstants.UNIQUE_EVENT_IDS.GARDENER
		) <= 1;

		if (nextSeedId === null) {
			const packet = await playerHasSeed(player.id)
				? await explainBlockedSeed(response, player, {
					conditionKey: SEED_CONDITION_FAILURE.SEED_SLOT_FULL,
					seedId: 0
				})
				: await handleFallback(response, player, SEED_CONDITION_FAILURE.ALL_SEEDS_OBTAINED);
			response.push(makePacket(SmallEventGardenerPacket, {
				...packet, isFirstEncounter
			}));
			return;
		}

		const conditions = await checkSeedConditions(player, nextSeedId, home);

		if (!conditions.canObtain) {
			const packet = await explainBlockedSeed(response, player, {
				conditionKey: conditions.conditionKey,
				seedId: nextSeedId
			});
			response.push(makePacket(SmallEventGardenerPacket, {
				...packet, isFirstEncounter
			}));
			return;
		}

		const cost = PlantConstants.SEED_COSTS[nextSeedId];

		if (cost > 0) {
			const collector = new ReactionCollectorGardener(nextSeedId, cost, conditions.conditionKey, isFirstEncounter);
			const collectorPacket = new ReactionCollectorInstance(
				collector,
				context,
				{
					allowedPlayerKeycloakIds: [player.keycloakId]
				},
				getPaidSeedEndCallback(player, nextSeedId)
			)
				.block(player.keycloakId, BlockingConstants.REASONS.GARDENER_SMALL_EVENT)
				.build();
			response.push(collectorPacket);
		}
		else {
			const packet = await giveSeedToPlayer(response, player, nextSeedId, conditions.conditionKey);
			response.push(makePacket(SmallEventGardenerPacket, {
				...packet, isFirstEncounter
			}));
		}
	},

	// The plant gift may go to the home plant storage
	getAdditionalLockKeys: getPlantReceiverLockKeys,

	isGuaranteed: isGardenerGuaranteed
};
