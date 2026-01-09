import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import {
	ExpeditionConstants, ExpeditionLocationType,
	getPetExpeditionPreference, DISLIKED_SHORT_EXPEDITION_FAILURE_BONUS, DISLIKED_EXPEDITION_DURATION_THRESHOLD_MINUTES,
	generateTerrainBasedRisk
} from "../../../../Lib/src/constants/ExpeditionConstants";
import {
	ExpeditionData
} from "../../../../Lib/src/packets/commands/CommandPetExpeditionPacket";
import { Pet } from "../../data/Pet";
import {
	calculateRewardIndex, calculateRewards, ExpeditionRewardDataWithItem
} from "./ExpeditionRewardCalculator";
import { MapLinkDataController } from "../../data/MapLink";
import {
	MapLocation, MapLocationDataController
} from "../../data/MapLocation";
import { MapConstants } from "../../../../Lib/src/constants/MapConstants";
import { MathUtils } from "../utils/MathUtils";

/**
 * Counter to ensure unique expedition IDs even when generated in the same millisecond
 */
let expeditionIdCounter = 0;

/**
 * Get expedition location type from map location
 * Uses expeditionType override if defined, otherwise derives from map type
 * @param mapLocation - The map location (can be null/undefined)
 * @returns The corresponding expedition location type
 */
function getExpeditionTypeFromMapLocation(mapLocation: MapLocation | null): ExpeditionLocationType {
	if (!mapLocation) {
		return ExpeditionConstants.EXPEDITION_LOCATION_TYPES.PLAINS;
	}

	// Use explicit expeditionType if defined, otherwise derive from map type
	if (mapLocation.expeditionType) {
		return mapLocation.expeditionType;
	}

	return ExpeditionConstants.MAP_TYPE_TO_EXPEDITION_TYPE[mapLocation.type] ?? ExpeditionConstants.EXPEDITION_LOCATION_TYPES.PLAINS;
}

/**
 * Generate a unique expedition ID
 * Uses timestamp + counter + random number to ensure uniqueness even in rapid succession
 */
function generateExpeditionId(): string {
	expeditionIdCounter = (expeditionIdCounter + 1) % ExpeditionConstants.ID_GENERATION.RANDOM_MAX;
	return `${ExpeditionConstants.ID_GENERATION.PREFIX}_${Date.now()}_${expeditionIdCounter}_${RandomUtils.randInt(
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

	// Generate terrain-based risk using the location type's difficulty curve
	const riskRate = generateTerrainBasedRisk(
		locationType,
		RandomUtils.crowniclesRandom.realZeroToOneInclusive()
	);

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
	durationRanges: DurationRange[]
): ExpeditionData[] {
	const expeditions: ExpeditionData[] = [];

	for (let i = 0; i < ExpeditionConstants.LOCAL_EXPEDITIONS_COUNT && i < localMapLocationIds.length; i++) {
		const mapLocationId = localMapLocationIds[i];
		const mapLocation = MapLocationDataController.instance.getById(mapLocationId);
		const locationType = getExpeditionTypeFromMapLocation(mapLocation);

		const expedition = generateExpeditionWithConstraints({
			durationRange: durationRanges[i],
			locationType,
			mapLocationId,
			isDistantExpedition: false
		});


		expeditions.push(expedition);
	}

	return expeditions;
}

/**
 * Fill missing local expeditions with random ones
 */
function fillMissingLocalExpeditions(
	expeditions: ExpeditionData[],
	durationRanges: DurationRange[]
): void {
	while (expeditions.length < ExpeditionConstants.LOCAL_EXPEDITIONS_COUNT) {
		const allLocationTypes = Object.values(ExpeditionConstants.EXPEDITION_LOCATION_TYPES) as ExpeditionLocationType[];
		const expedition = generateExpeditionWithConstraints({
			durationRange: durationRanges[expeditions.length],
			locationType: RandomUtils.crowniclesRandom.pick(allLocationTypes)
		});

		expeditions.push(expedition);
	}
}

/**
 * Bonus types that can be applied to expeditions (mutually exclusive)
 */
enum ExpeditionBonusType {
	NONE,
	CLONE_TALISMAN,
	BONUS_TOKENS
}

/**
 * Determine which bonus type should be applied to expeditions
 * Clone talisman bonus (1/20) has priority over triple tokens bonus (1/50) when player doesn't have clone talisman
 * If player already has clone talisman, only triple tokens bonus can be applied
 */
function determineBonusType(hasCloneTalisman: boolean): ExpeditionBonusType {
	if (!hasCloneTalisman) {
		// Player doesn't have clone talisman: check for clone talisman bonus first (1/20)
		if (RandomUtils.crowniclesRandom.bool(1 / ExpeditionConstants.CLONE_TALISMAN.BONUS_EXPEDITION_CHANCE)) {
			return ExpeditionBonusType.CLONE_TALISMAN;
		}
	}

	// Check for bonus tokens (1/50)
	if (RandomUtils.crowniclesRandom.bool(1 / ExpeditionConstants.BONUS_TOKENS.TOKEN_BONUS_EXPEDITION_CHANCE)) {
		return ExpeditionBonusType.BONUS_TOKENS;
	}

	return ExpeditionBonusType.NONE;
}

/**
 * Apply bonus to an expedition based on bonus type
 */
function applyBonusToExpedition(expedition: ExpeditionData, bonusType: ExpeditionBonusType): void {
	switch (bonusType) {
		case ExpeditionBonusType.CLONE_TALISMAN:
			expedition.hasCloneTalismanBonus = true;
			break;
		case ExpeditionBonusType.BONUS_TOKENS:
			expedition.hasBonusTokens = true;
			break;
		default:
			// No bonus to apply
			break;
	}
}

/**
 * Generate the distant expedition
 */
function generateDistantExpedition(
	localMapLocationIds: number[],
	durationRanges: DurationRange[]
): ExpeditionData {
	const distantMapLocationId = getRandomDistantMapLocation(localMapLocationIds);
	const distantMapLocation = MapLocationDataController.instance.getById(distantMapLocationId);
	const distantLocationType = getExpeditionTypeFromMapLocation(distantMapLocation);

	return generateExpeditionWithConstraints({
		durationRange: durationRanges[ExpeditionConstants.LOCAL_EXPEDITIONS_COUNT],
		locationType: distantLocationType,
		mapLocationId: distantMapLocationId,
		isDistantExpedition: true
	});
}

/**
 * Calculate which expedition should receive the bonus (if any)
 */
function calculateBonusExpeditionIndex(bonusType: ExpeditionBonusType): number {
	if (bonusType === ExpeditionBonusType.NONE) {
		return ExpeditionConstants.NO_BONUS_EXPEDITION;
	}
	return RandomUtils.randInt(0, ExpeditionConstants.TOTAL_EXPEDITIONS_COUNT);
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

	// Determine which bonus to apply and to which expedition
	const bonusType = determineBonusType(hasCloneTalisman);
	const bonusExpeditionIndex = calculateBonusExpeditionIndex(bonusType);

	// Generate local expeditions
	const localExpeditions = generateLocalExpeditions(localMapLocationIds, durationRanges);
	fillMissingLocalExpeditions(localExpeditions, durationRanges);

	// Generate distant expedition
	const distantExpedition = generateDistantExpedition(localMapLocationIds, durationRanges);

	// Combine all expeditions
	const allExpeditions = [...localExpeditions, distantExpedition];

	// Apply bonus to the selected expedition
	if (bonusExpeditionIndex >= 0 && bonusExpeditionIndex < allExpeditions.length) {
		applyBonusToExpedition(allExpeditions[bonusExpeditionIndex], bonusType);
	}

	return allExpeditions;
}

/**
 * Parameters for calculating effective risk
 */
export interface EffectiveRiskParams {
	expedition: ExpeditionData;
	petModel: Pet;
	petTypeId: number;
	petLovePoints: number;
	foodConsumed: number | null;
	foodRequired: number | null;
}

/**
 * Calculate the effective risk based on pet stats and expedition parameters
 * If insufficient food was consumed, the risk is multiplied by NO_FOOD_RISK_MULTIPLIER
 * If pet dislikes the location and expedition is shorter than 12 hours, adds 10% extra failure risk
 */
export function calculateEffectiveRisk(params: EffectiveRiskParams): number {
	const {
		expedition, petModel, petTypeId, petLovePoints, foodConsumed, foodRequired
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

	// Apply extra failure risk if pet dislikes the location and expedition is shorter than 12 hours
	const petPreference = getPetExpeditionPreference(petTypeId, expedition.locationType);
	if (petPreference === "disliked" && expedition.durationMinutes < DISLIKED_EXPEDITION_DURATION_THRESHOLD_MINUTES) {
		effectiveRisk += DISLIKED_SHORT_EXPEDITION_FAILURE_BONUS;
	}

	return MathUtils.clamp(effectiveRisk, 0, ExpeditionConstants.PERCENTAGE.MAX);
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
 * Parameters for determining expedition outcome
 */
export interface ExpeditionOutcomeParams {
	effectiveRisk: number;
	expedition: ExpeditionData;
	rewardIndex: number;
	hasCloneTalisman: boolean;
	playerCurrentTokens: number;
	petTypeId: number;
}

/**
 * Determine expedition outcome based on effective risk
 */
export function determineExpeditionOutcome(params: ExpeditionOutcomeParams): ExpeditionOutcome {
	const totalFailure = RandomUtils.crowniclesRandom.bool(params.effectiveRisk / ExpeditionConstants.PERCENTAGE.MAX);

	if (totalFailure) {
		return {
			totalFailure: true,
			partialSuccess: false,
			rewards: undefined,
			loveChange: ExpeditionConstants.LOVE_CHANGES.TOTAL_FAILURE
		};
	}

	const partialSuccess = RandomUtils.crowniclesRandom.bool(params.effectiveRisk / ExpeditionConstants.PERCENTAGE.MAX);
	const rewards = calculateRewards({
		expedition: params.expedition,
		rewardIndex: params.rewardIndex,
		isPartialSuccess: partialSuccess,
		hasCloneTalisman: params.hasCloneTalisman,
		playerCurrentTokens: params.playerCurrentTokens,
		petTypeId: params.petTypeId
	});

	return {
		totalFailure: false,
		partialSuccess,
		rewards,
		loveChange: partialSuccess ? 0 : ExpeditionConstants.LOVE_CHANGES.TOTAL_SUCCESS
	};
}
