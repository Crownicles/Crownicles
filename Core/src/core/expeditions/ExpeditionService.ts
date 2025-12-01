import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import {
	ExpeditionConstants, ExpeditionLocationType
} from "../../../../Lib/src/constants/ExpeditionConstants";
import {
	ExpeditionData
} from "../../../../Lib/src/packets/commands/CommandPetExpeditionPacket";
import { Pet } from "../../data/Pet";
import {
	calculateRewardIndex, calculateRewards, ExpeditionRewardDataWithItem
} from "./ExpeditionRewardCalculator";
import { MapLinkDataController } from "../../data/MapLink";
import { MapLocationDataController } from "../../data/MapLocation";
import { MapConstants } from "../../../../Lib/src/constants/MapConstants";

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
 * Duration range for expedition generation
 */
interface DurationRange {
	min: number;
	max: number;
}

/**
 * Parameters for generating an expedition
 */
interface ExpeditionGenerationParams {
	durationRange: DurationRange;
	locationType: ExpeditionLocationType;
	mapLocationId?: number;
	isDistantExpedition?: boolean;
}

/**
 * Generate a single random expedition with specified duration range and location
 */
function generateExpeditionWithConstraints(params: ExpeditionGenerationParams): ExpeditionData {
	const {
		durationRange, locationType, mapLocationId, isDistantExpedition
	} = params;

	const durationMinutes = RandomUtils.crowniclesRandom.integer(
		durationRange.min,
		durationRange.max
	);

	const riskRate = RandomUtils.rangedInt(ExpeditionConstants.RISK_RATE);

	const difficulty = RandomUtils.rangedInt(ExpeditionConstants.DIFFICULTY);

	const wealthRate = RandomUtils.crowniclesRandom.realZeroToOneInclusive()
		* (ExpeditionConstants.WEALTH_RATE.MAX - ExpeditionConstants.WEALTH_RATE.MIN)
		+ ExpeditionConstants.WEALTH_RATE.MIN;

	const expeditionData: ExpeditionData = {
		id: generateExpeditionId(),
		durationMinutes,
		displayDurationMinutes: Math.round(durationMinutes / ExpeditionConstants.DURATION_DISPLAY_ROUNDING) * ExpeditionConstants.DURATION_DISPLAY_ROUNDING,
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
		.filter(loc => loc.attribute === MapConstants.MAP_ATTRIBUTES.CONTINENT1 && !excludeIds.includes(loc.id));

	if (allLocations.length === 0) {
		// Fallback: just pick any location from continent 1
		const fallback = MapLocationDataController.instance.getAll()
			.find(loc => loc.attribute === MapConstants.MAP_ATTRIBUTES.CONTINENT1);
		return fallback?.id ?? ExpeditionConstants.DEFAULT_MAP_LOCATION_ID;
	}

	return RandomUtils.crowniclesRandom.pick(allLocations).id;
}

/**
 * Generate local expeditions based on map locations from player's current link
 */
function generateLocalExpeditions(
	localMapLocationIds: number[],
	durationRanges: DurationRange[],
	bonusExpeditionIndex: number
): ExpeditionData[] {
	const expeditions: ExpeditionData[] = [];

	for (let i = 0; i < ExpeditionConstants.LOCAL_EXPEDITIONS_COUNT && i < localMapLocationIds.length; i++) {
		const mapLocationId = localMapLocationIds[i];
		const mapLocation = MapLocationDataController.instance.getById(mapLocationId);
		const locationType = ExpeditionConstants.getExpeditionTypeFromMapType(mapLocation?.type ?? ExpeditionConstants.DEFAULT_MAP_TYPE);

		const expedition = generateExpeditionWithConstraints({
			durationRange: durationRanges[i],
			locationType,
			mapLocationId,
			isDistantExpedition: false
		});

		if (bonusExpeditionIndex === i) {
			expedition.hasCloneTalismanBonus = true;
		}

		expeditions.push(expedition);
	}

	return expeditions;
}

/**
 * Fill missing local expeditions with random ones
 */
function fillMissingLocalExpeditions(
	expeditions: ExpeditionData[],
	durationRanges: DurationRange[],
	bonusExpeditionIndex: number
): void {
	while (expeditions.length < ExpeditionConstants.LOCAL_EXPEDITIONS_COUNT) {
		const allLocationTypes = Object.values(ExpeditionConstants.LOCATION_TYPES) as ExpeditionLocationType[];
		const expedition = generateExpeditionWithConstraints({
			durationRange: durationRanges[expeditions.length],
			locationType: RandomUtils.crowniclesRandom.pick(allLocationTypes)
		});

		if (bonusExpeditionIndex === expeditions.length) {
			expedition.hasCloneTalismanBonus = true;
		}

		expeditions.push(expedition);
	}
}

/**
 * Generate 3 expeditions based on player's current map position
 * - 2 first expeditions: linked to the 2 mapLocations of player's current mapLink
 * - 3rd expedition: "distant expedition" to a random location on the map
 * @param mapLinkId - The player's current mapLink ID
 * @param hasCloneTalisman - Whether the player already has the clone talisman (no bonus if true)
 */
export function generateThreeExpeditions(mapLinkId: number, hasCloneTalisman: boolean): ExpeditionData[] {
	const localMapLocationIds = getMapLocationsFromLink(mapLinkId);
	const durationRanges = ExpeditionConstants.getDurationRangesArray();

	// Determine if a bonus expedition should exist
	const bonusExpeditionIndex = hasCloneTalisman
		? ExpeditionConstants.NO_BONUS_EXPEDITION
		: RandomUtils.crowniclesRandom.bool(1 / ExpeditionConstants.CLONE_TALISMAN.BONUS_EXPEDITION_CHANCE)
			? RandomUtils.randInt(0, ExpeditionConstants.TOTAL_EXPEDITIONS_COUNT)
			: ExpeditionConstants.NO_BONUS_EXPEDITION;

	// Generate local expeditions
	const localExpeditions = generateLocalExpeditions(localMapLocationIds, durationRanges, bonusExpeditionIndex);

	// Fill with random expeditions if needed
	fillMissingLocalExpeditions(localExpeditions, durationRanges, bonusExpeditionIndex);

	// Generate distant expedition
	const distantMapLocationId = getRandomDistantMapLocation(localMapLocationIds);
	const distantMapLocation = MapLocationDataController.instance.getById(distantMapLocationId);
	const distantLocationType = ExpeditionConstants.getExpeditionTypeFromMapType(distantMapLocation?.type ?? ExpeditionConstants.DEFAULT_MAP_TYPE);

	const distantExpedition = generateExpeditionWithConstraints({
		durationRange: durationRanges[ExpeditionConstants.LOCAL_EXPEDITIONS_COUNT],
		locationType: distantLocationType,
		mapLocationId: distantMapLocationId,
		isDistantExpedition: true
	});

	if (bonusExpeditionIndex === ExpeditionConstants.LOCAL_EXPEDITIONS_COUNT) {
		distantExpedition.hasCloneTalismanBonus = true;
	}

	return [...localExpeditions, distantExpedition];
}

/**
 * Parameters for calculating effective risk
 */
export interface EffectiveRiskParams {
	expedition: ExpeditionData;
	petModel: Pet;
	petLovePoints: number;
	foodConsumed: number | null;
	foodRequired: number | null;
}

/**
 * Calculate the effective risk based on pet stats and expedition parameters
 * If insufficient food was consumed, the risk is multiplied by NO_FOOD_RISK_MULTIPLIER
 */
export function calculateEffectiveRisk(params: EffectiveRiskParams): number {
	const {
		expedition, petModel, petLovePoints, foodConsumed, foodRequired
	} = params;

	let effectiveRisk = expedition.riskRate
		+ expedition.difficulty / ExpeditionConstants.EFFECTIVE_RISK_FORMULA.DIFFICULTY_DIVISOR
		- petModel.force
		- petLovePoints / ExpeditionConstants.EFFECTIVE_RISK_FORMULA.LOVE_DIVISOR;

	// Apply food penalty if insufficient food was consumed
	const hasInsufficientFood = foodConsumed !== null
		&& foodRequired !== null
		&& foodConsumed < foodRequired;

	if (hasInsufficientFood) {
		effectiveRisk *= ExpeditionConstants.NO_FOOD_RISK_MULTIPLIER;
	}

	return Math.max(0, Math.min(ExpeditionConstants.PERCENTAGE.MAX, effectiveRisk));
}

/**
 * Expedition outcome after resolution
 */
export interface ExpeditionOutcome {
	totalFailure: boolean;
	partialSuccess: boolean;
	rewards: ExpeditionRewardDataWithItem | undefined;
	loveChange: number;
}

/**
 * Determine expedition outcome based on effective risk
 */
export function determineExpeditionOutcome(
	effectiveRisk: number,
	expedition: ExpeditionData,
	rewardIndex: number,
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
	const rewards = calculateRewards({
		expedition,
		rewardIndex,
		isPartialSuccess: partialSuccess,
		hasCloneTalisman
	});

	return {
		totalFailure: false,
		partialSuccess,
		rewards,
		loveChange: partialSuccess ? 0 : ExpeditionConstants.LOVE_CHANGES.TOTAL_SUCCESS
	};
}
