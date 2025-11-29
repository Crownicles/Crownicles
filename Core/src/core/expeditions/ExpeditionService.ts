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
 * Shuffle an array using Fisher-Yates algorithm
 */
function shuffleArray<T>(array: T[]): T[] {
	const result = [...array];
	for (let i = result.length - 1; i > 0; i--) {
		const j = RandomUtils.randInt(0, i + 1);
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
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
	locationType: ExpeditionLocationType
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
		locationType
	};

	// Calculate food cost based on reward index
	expeditionData.foodCost = ExpeditionConstants.FOOD_CONSUMPTION[calculateRewardIndex(expeditionData)];

	return expeditionData;
}

/**
 * Generate 3 expeditions with different locations and fixed duration ranges
 */
export function generateThreeExpeditions(): ExpeditionData[] {
	// Get all location types and shuffle them to ensure 3 different locations
	const allLocationTypes = Object.values(ExpeditionConstants.LOCATION_TYPES) as ExpeditionLocationType[];
	const shuffledLocations = shuffleArray(allLocationTypes);

	return [
		generateExpeditionWithConstraints(DURATION_RANGES[0], shuffledLocations[0]),
		generateExpeditionWithConstraints(DURATION_RANGES[1], shuffledLocations[1]),
		generateExpeditionWithConstraints(DURATION_RANGES[2], shuffledLocations[2])
	];
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
