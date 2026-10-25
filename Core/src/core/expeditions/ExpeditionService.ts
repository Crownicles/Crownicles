import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import {
	ExpeditionConstants, ExpeditionLocationType,
	getPetExpeditionPreference, DISLIKED_SHORT_EXPEDITION_FAILURE_BONUS, DISLIKED_EXPEDITION_DURATION_THRESHOLD_MINUTES,
	generateTerrainBasedRisk, LIKED_EXPEDITION_FAILURE_REDUCTION, PetExpeditionPreferences
} from "../../../../Lib/src/constants/ExpeditionConstants";
import { getDurationRangesArray } from "../../../../Lib/src/utils/ExpeditionUtils";
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
import { MathUtils } from "../utils/MathUtils";

/**
 * Counter to ensure unique expedition IDs even when generated in the same millisecond
 */
let expeditionIdCounter = 0;

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
 * Draw the wealth rate of an expedition
 */
function rollWealthRate(): number {
	const wealthRate = RandomUtils.crowniclesRandom.realZeroToOneInclusive()
		* (ExpeditionConstants.WEALTH_RATE.MAX - ExpeditionConstants.WEALTH_RATE.MIN)
		+ ExpeditionConstants.WEALTH_RATE.MIN;
	return Math.round(wealthRate * ExpeditionConstants.PERCENTAGE.DECIMAL_PRECISION) / ExpeditionConstants.PERCENTAGE.DECIMAL_PRECISION;
}

/**
 * Generate an expedition in the given terrain, whose duration is in the given range.
 * Every expedition is drawn independently, even when several biomes of the same location are offered.
 */
function generateExpedition(params: ExpeditionGenerationParams): ExpeditionData {
	const {
		durationRange, locationType, mapLocationId, isDistantExpedition
	} = params;
	const durationMinutes = RandomUtils.crowniclesRandom.integer(durationRange.min, durationRange.max);

	const expeditionData: ExpeditionData = {
		id: generateExpeditionId(),
		durationMinutes,
		displayDurationMinutes: Math.round(durationMinutes / ExpeditionConstants.DURATION_DISPLAY_ROUNDING) * ExpeditionConstants.DURATION_DISPLAY_ROUNDING,

		// Terrain-based risk using the location type's difficulty curve
		riskRate: generateTerrainBasedRisk(locationType, RandomUtils.crowniclesRandom.realZeroToOneInclusive()),
		difficulty: RandomUtils.rangedInt(ExpeditionConstants.DIFFICULTY),
		wealthRate: rollWealthRate(),
		locationType,
		mapLocationId,
		isDistantExpedition
	};

	// Calculate food cost based on reward index
	expeditionData.foodCost = ExpeditionConstants.FOOD_CONSUMPTION[calculateRewardIndex(expeditionData)];

	return expeditionData;
}

/**
 * Position of the player on the map when choosing an expedition
 */
export interface ExpeditionPlayerPosition {
	mapLinkId: number;

	/**
	 * Progress of the player on the map link, from 0 (departure) to 1 (arrived)
	 */
	travelProgress: number;
}

/**
 * Get the two map locations linked to the player's mapLink, the closest one to the player first
 */
function getMapLocationsFromLinkByProximity(position: ExpeditionPlayerPosition): number[] {
	const mapLink = MapLinkDataController.instance.getById(position.mapLinkId);
	if (!mapLink) {
		return [];
	}
	return position.travelProgress < ExpeditionConstants.DESTINATION_CLOSER_TRAVEL_PROGRESS
		? [mapLink.startMap, mapLink.endMap]
		: [mapLink.endMap, mapLink.startMap];
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
 * Generate local expeditions based on map locations from player's current link, the closest one being the shortest.
 * A location mixing several biomes offers one independently drawn expedition per biome, in the duration range of the location.
 */
function generateLocalExpeditions(
	localMapLocationIds: number[],
	durationRanges: DurationRange[]
): ExpeditionData[] {
	const expeditions: ExpeditionData[] = [];

	for (let i = 0; i < ExpeditionConstants.LOCAL_EXPEDITIONS_COUNT && i < localMapLocationIds.length; i++) {
		const mapLocationId = localMapLocationIds[i];
		const mapLocation = MapLocationDataController.instance.getById(mapLocationId)!;

		for (const locationType of mapLocation.biomes) {
			expeditions.push(generateExpedition({
				durationRange: durationRanges[i],
				locationType,
				mapLocationId,
				isDistantExpedition: false
			}));
		}
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
		const expedition = generateExpedition({
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
	const distantMapLocation = MapLocationDataController.instance.getById(distantMapLocationId)!;
	const distantLocationType = distantMapLocation.pickBiome();

	return generateExpedition({
		durationRange: durationRanges[ExpeditionConstants.LOCAL_EXPEDITIONS_COUNT],
		locationType: distantLocationType,
		mapLocationId: distantMapLocationId,
		isDistantExpedition: true
	});
}

/**
 * Calculate which of the proposed expeditions should receive the bonus (if any)
 */
function calculateBonusExpeditionIndex(bonusType: ExpeditionBonusType, expeditions: ExpeditionData[]): number {
	if (bonusType === ExpeditionBonusType.NONE) {
		return ExpeditionConstants.NO_BONUS_EXPEDITION;
	}
	return RandomUtils.randInt(0, expeditions.length);
}

/**
 * Generate the expeditions proposed from the player's current map position
 * - Short expeditions: one per biome of the mapLocation of the player's current mapLink closest to the player
 * - Medium expeditions: one per biome of the other mapLocation of the mapLink
 * - Last expedition: "distant expedition" to a random location on the map
 * @param position - The player's position on the map
 * @param hasCloneTalisman - Whether the player already has the clone talisman (no bonus if true)
 */
export function generateExpeditionChoices(position: ExpeditionPlayerPosition, hasCloneTalisman: boolean): ExpeditionData[] {
	const localMapLocationIds = getMapLocationsFromLinkByProximity(position);
	const durationRanges = getDurationRangesArray();

	// Determine which bonus to apply
	const bonusType = determineBonusType(hasCloneTalisman);

	// Generate local expeditions
	const localExpeditions = generateLocalExpeditions(localMapLocationIds, durationRanges);
	fillMissingLocalExpeditions(localExpeditions, durationRanges);

	// Generate distant expedition
	const distantExpedition = generateDistantExpedition(localMapLocationIds, durationRanges);

	// Combine all expeditions
	const allExpeditions = [...localExpeditions, distantExpedition];

	// Apply bonus to the selected expedition
	const bonusExpeditionIndex = calculateBonusExpeditionIndex(bonusType, allExpeditions);
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
 * If pet likes the location, reduces failure risk by 5%
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

	// Apply preference-based risk modifiers
	const petPreference = getPetExpeditionPreference(petTypeId, expedition.locationType);

	// Apply extra failure risk if pet dislikes the location and expedition is shorter than 12 hours
	if (petPreference === PetExpeditionPreferences.DISLIKED && expedition.durationMinutes < DISLIKED_EXPEDITION_DURATION_THRESHOLD_MINUTES) {
		return MathUtils.clamp(effectiveRisk + DISLIKED_SHORT_EXPEDITION_FAILURE_BONUS, 0, ExpeditionConstants.PERCENTAGE.MAX);
	}

	// Apply failure reduction if pet likes the location
	if (petPreference === PetExpeditionPreferences.LIKED) {
		return MathUtils.clamp(effectiveRisk - LIKED_EXPEDITION_FAILURE_REDUCTION, 0, ExpeditionConstants.PERCENTAGE.MAX);
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

	/**
	 * True if the pet liked this expedition type
	 */
	petLikedExpedition: boolean;
}

/**
 * Parameters for determining expedition outcome
 */
export interface ExpeditionOutcomeParams {
	effectiveRisk: number;
	expedition: ExpeditionData;
	rewardIndex: number;
	hasCloneTalisman: boolean;
	petTypeId: number;
}

/**
 * Calculate the love change based on expedition outcome and pet preference
 */
function calculateLoveChange(partialSuccess: boolean, petLikedExpedition: boolean): number {
	if (partialSuccess) {
		// Partial success only gives love points if pet liked the expedition
		return petLikedExpedition ? ExpeditionConstants.LOVE_CHANGES.PARTIAL_SUCCESS : 0;
	}

	// Total success - apply liked multiplier if applicable
	return petLikedExpedition
		? ExpeditionConstants.LOVE_CHANGES.TOTAL_SUCCESS * ExpeditionConstants.LOVE_CHANGES.LIKED_EXPEDITION_MULTIPLIER
		: ExpeditionConstants.LOVE_CHANGES.TOTAL_SUCCESS;
}

/**
 * Determine expedition outcome based on effective risk
 */
export function determineExpeditionOutcome(params: ExpeditionOutcomeParams): ExpeditionOutcome {
	const petPreference = getPetExpeditionPreference(params.petTypeId, params.expedition.locationType);
	const petLikedExpedition = petPreference === PetExpeditionPreferences.LIKED;
	const totalFailure = RandomUtils.crowniclesRandom.bool(params.effectiveRisk / ExpeditionConstants.PERCENTAGE.MAX);

	if (totalFailure) {
		return {
			totalFailure: true,
			partialSuccess: false,
			rewards: undefined,
			loveChange: ExpeditionConstants.LOVE_CHANGES.TOTAL_FAILURE,
			petLikedExpedition
		};
	}

	const partialSuccess = RandomUtils.crowniclesRandom.bool(params.effectiveRisk / ExpeditionConstants.PERCENTAGE.MAX);
	const rewards = calculateRewards({
		expedition: params.expedition,
		rewardIndex: params.rewardIndex,
		isPartialSuccess: partialSuccess,
		hasCloneTalisman: params.hasCloneTalisman,
		petTypeId: params.petTypeId
	});

	return {
		totalFailure: false,
		partialSuccess,
		rewards,
		loveChange: calculateLoveChange(partialSuccess, petLikedExpedition),
		petLikedExpedition
	};
}
