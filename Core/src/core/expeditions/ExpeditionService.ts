import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import {
	ExpeditionConstants, ExpeditionLocationType
} from "../../../../Lib/src/constants/ExpeditionConstants";
import {
	ExpeditionData, ExpeditionRewardData
} from "../../../../Lib/src/packets/commands/CommandPetExpeditionPacket";
import { Pet } from "../../data/Pet";
import {
	calculateRewardIndex, calculateRewards
} from "./ExpeditionRewardCalculator";
import { MapLinkDataController } from "../../data/MapLink";
import { MapLocationDataController } from "../../data/MapLocation";
import { MapConstants } from "../../../../Lib/src/constants/MapConstants";

/**
 * Duration ranges for the 3 expedition slots
 * Slot 0: Short (10 min - 1 hour)
 * Slot 1: Medium (15 min - 10 hours)
 * Slot 2: Long (30 min - 3 days)
 */
const DURATION_RANGES = [
	{
		min: 10, max: 60
	},
	{
		min: 15, max: 10 * 60
	},
	{
		min: 30, max: 3 * 24 * 60
	}
];

/**
 * Map location types to expedition location types
 * This allows using the existing reward calculation system based on location types
 */
const MAP_TYPE_TO_EXPEDITION_TYPE: Record<string, ExpeditionLocationType> = {
	fo: "forest",
	mo: "mountain",
	de: "desert",
	ruins: "ruins",
	be: "coast",
	ri: "coast",
	la: "swamp",
	pl: "plains",
	ro: "plains",
	vi: "plains",
	ci: "cave",
	castleEntrance: "ruins",
	castleThrone: "ruins",
	continent: "plains"
};

/**
 * Get expedition location type from map location type
 */
function getExpeditionTypeFromMapType(mapType: string): ExpeditionLocationType {
	return MAP_TYPE_TO_EXPEDITION_TYPE[mapType] ?? "plains";
}

/**
 * Generate a unique expedition ID
 */
function generateExpeditionId(): string {
	return `${ExpeditionConstants.ID_GENERATION.PREFIX}_${Date.now()}_${RandomUtils.randInt(
		ExpeditionConstants.ID_GENERATION.RANDOM_MIN,
		ExpeditionConstants.ID_GENERATION.RANDOM_MAX
	)}`;
}

/**
 * Generate a single random expedition with specified duration range and location
 */
function generateExpeditionWithConstraints(
	durationRange: {
		min: number; max: number;
	},
	locationType: ExpeditionLocationType,
	mapLocationId?: number,
	isDistantExpedition?: boolean
): ExpeditionData {
	const durationMinutes = RandomUtils.randInt(
		durationRange.min,
		durationRange.max + 1
	);

	const riskRate = RandomUtils.randInt(
		ExpeditionConstants.RISK_RATE.MIN,
		ExpeditionConstants.RISK_RATE.MAX + 1
	);

	const difficulty = RandomUtils.randInt(
		ExpeditionConstants.DIFFICULTY.MIN,
		ExpeditionConstants.DIFFICULTY.MAX + 1
	);

	const wealthRate = RandomUtils.crowniclesRandom.realZeroToOneInclusive()
		* (ExpeditionConstants.WEALTH_RATE.MAX - ExpeditionConstants.WEALTH_RATE.MIN)
		+ ExpeditionConstants.WEALTH_RATE.MIN;

	const expeditionData: ExpeditionData = {
		id: generateExpeditionId(),
		durationMinutes,
		riskRate,
		difficulty,
		wealthRate: Math.round(wealthRate * ExpeditionConstants.PERCENTAGE.DECIMAL_PRECISION) / ExpeditionConstants.PERCENTAGE.DECIMAL_PRECISION,
		locationType,
		mapLocationId,
		isDistantExpedition
	};

	// Calculate food cost based on reward index
	expeditionData.foodCost = ExpeditionConstants.FOOD_CONSUMPTION[calculateRewardIndex(expeditionData)];

	return expeditionData;
}

/**
 * Get the two map locations linked to a mapLink
 */
function getMapLocationsFromLink(mapLinkId: number): number[] {
	const mapLink = MapLinkDataController.instance.getById(mapLinkId);
	if (!mapLink) {
		return [];
	}
	return [mapLink.startMap, mapLink.endMap];
}

/**
 * Get a random map location from the main continent, excluding given locations
 */
function getRandomDistantMapLocation(excludeIds: number[]): number {
	const allLocations = MapLocationDataController.instance.getAll()
		.filter(loc =>
			loc.attribute === MapConstants.MAP_ATTRIBUTES.CONTINENT1
			&& !excludeIds.includes(loc.id)
		);

	if (allLocations.length === 0) {
		// Fallback: just pick any location from continent 1
		const fallback = MapLocationDataController.instance.getAll()
			.find(loc => loc.attribute === MapConstants.MAP_ATTRIBUTES.CONTINENT1);
		return fallback?.id ?? 1;
	}

	return RandomUtils.crowniclesRandom.pick(allLocations).id;
}

/**
 * Generate 3 expeditions based on player's current map position
 * - 2 first expeditions: linked to the 2 mapLocations of player's current mapLink
 * - 3rd expedition: "distant expedition" to a random location on the map
 * @param mapLinkId - The player's current mapLink ID
 */
export function generateThreeExpeditions(mapLinkId: number): ExpeditionData[] {
	const localMapLocationIds = getMapLocationsFromLink(mapLinkId);

	// Get map location data for the first two expeditions
	const localExpeditions: ExpeditionData[] = [];

	for (let i = 0; i < 2 && i < localMapLocationIds.length; i++) {
		const mapLocationId = localMapLocationIds[i];
		const mapLocation = MapLocationDataController.instance.getById(mapLocationId);
		const locationType = getExpeditionTypeFromMapType(mapLocation?.type ?? "ro");

		localExpeditions.push(
			generateExpeditionWithConstraints(
				DURATION_RANGES[i],
				locationType,
				mapLocationId,
				false
			)
		);
	}

	// If we couldn't get 2 local expeditions (edge case), fill with random
	while (localExpeditions.length < 2) {
		const allLocationTypes = Object.values(ExpeditionConstants.LOCATION_TYPES) as ExpeditionLocationType[];
		localExpeditions.push(generateExpeditionWithConstraints(
			DURATION_RANGES[localExpeditions.length],
			RandomUtils.crowniclesRandom.pick(allLocationTypes)
		));
	}

	// 3rd expedition: distant expedition to a random location
	const distantMapLocationId = getRandomDistantMapLocation(localMapLocationIds);
	const distantMapLocation = MapLocationDataController.instance.getById(distantMapLocationId);
	const distantLocationType = getExpeditionTypeFromMapType(distantMapLocation?.type ?? "ro");

	const distantExpedition = generateExpeditionWithConstraints(
		DURATION_RANGES[2],
		distantLocationType,
		distantMapLocationId,
		true
	);

	return [...localExpeditions, distantExpedition];
}

/**
 * Calculate the effective risk based on pet stats and expedition parameters
 */
export function calculateEffectiveRisk(expedition: ExpeditionData, petModel: Pet, petLovePoints: number): number {
	const effectiveRisk = expedition.riskRate
		+ expedition.difficulty / ExpeditionConstants.EFFECTIVE_RISK_FORMULA.DIFFICULTY_DIVISOR
		- petModel.force
		- petLovePoints / ExpeditionConstants.EFFECTIVE_RISK_FORMULA.LOVE_DIVISOR;

	return Math.max(0, Math.min(ExpeditionConstants.PERCENTAGE.MAX, effectiveRisk));
}

/**
 * Expedition outcome after resolution
 */
export interface ExpeditionOutcome {
	totalFailure: boolean;
	partialSuccess: boolean;
	rewards: ExpeditionRewardData | undefined;
	loveChange: number;
}

/**
 * Determine expedition outcome based on effective risk
 */
export function determineExpeditionOutcome(
	effectiveRisk: number,
	expedition: ExpeditionData,
	hasCloneTalisman: boolean
): ExpeditionOutcome {
	const totalFailure = RandomUtils.crowniclesRandom.bool(effectiveRisk / ExpeditionConstants.PERCENTAGE.MAX);

	if (totalFailure) {
		return {
			totalFailure: true,
			partialSuccess: false,
			rewards: undefined,
			loveChange: ExpeditionConstants.LOVE_CHANGES.TOTAL_FAILURE
		};
	}

	const partialSuccess = RandomUtils.crowniclesRandom.bool(effectiveRisk / ExpeditionConstants.PERCENTAGE.MAX);
	const rewardIndex = calculateRewardIndex(expedition);
	const rewards = calculateRewards(expedition, rewardIndex, partialSuccess, hasCloneTalisman);

	return {
		totalFailure: false,
		partialSuccess,
		rewards,
		loveChange: partialSuccess ? 0 : ExpeditionConstants.LOVE_CHANGES.TOTAL_SUCCESS
	};
}
