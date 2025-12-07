import {
	ExpeditionData, ExpeditionRewardData
} from "../../../../Lib/src/packets/commands/CommandPetExpeditionPacket";
import {
	ExpeditionConstants, ExpeditionLocationType
} from "../../../../Lib/src/constants/ExpeditionConstants";
import { TokensConstants } from "../../../../Lib/src/constants/TokensConstants";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import {
	generateRandomItem
} from "../utils/ItemUtils";
import { MathUtils } from "../utils/MathUtils";

/**
 * Extended reward data with item details for Core-side use
 * The front-end only receives ExpeditionRewardData, but Core needs itemId/itemCategory to give the item
 */
export interface ExpeditionRewardDataWithItem extends ExpeditionRewardData {
	itemId: number;
	itemCategory: number;
}

/**
 * Value range for linear score calculation
 */
interface ValueRange {
	value: number;
	min: number;
	max: number;
}

/**
 * Base rewards before any modifiers
 */
interface BaseRewards {
	money: number;
	experience: number;
	points: number;
}

/**
 * Item rarity constraints
 */
interface RarityRange {
	minRarity: number;
	maxRarity: number;
}

/**
 * Generated item reward data
 */
interface ItemReward {
	itemId: number;
	itemCategory: number;
}

function calculateTokensReward(rewardIndex: number, hasBonusTokens: boolean, playerCurrentTokens: number): number {
	const baseTokens = rewardIndex - TokensConstants.EXPEDITION.REWARD_INDEX_OFFSET;
	const finalTokens = hasBonusTokens
		? baseTokens * ExpeditionConstants.BONUS_TOKENS.MULTIPLIER
		: baseTokens;
	const randomBoost = RandomUtils.randInt(
		ExpeditionConstants.BONUS_TOKENS.RANDOM_BOOST_MIN,
		ExpeditionConstants.BONUS_TOKENS.RANDOM_BOOST_MAX
	);
	const calculatedTokens = Math.max(ExpeditionConstants.BONUS_TOKENS.MIN_TOKEN_REWARD, finalTokens + randomBoost);
	
	// Limit tokens to available slots (max capacity - current tokens)
	const availableSlots = TokensConstants.MAX - playerCurrentTokens;
	return Math.min(calculatedTokens, Math.max(0, availableSlots));
}

/**
 * Parameters for clone talisman drop calculation
 */
interface CloneTalismanDropParams {
	expedition: ExpeditionData;
	rewardIndex: number;
	hasCloneTalisman: boolean;
	isPartialSuccess: boolean;
}

/**
 * Parameters for reward calculation
 */
export interface RewardCalculationParams {
	expedition: ExpeditionData;
	rewardIndex: number;
	isPartialSuccess: boolean;
	hasCloneTalisman: boolean;
	playerCurrentTokens: number;
}

/**
 * Calculate a linear score based on how close a value is to its maximum
 * Returns a value in the COMPONENT_SCORE range (0-3)
 */
function calculateLinearScore(range: ValueRange): number {
	const percentage = (range.value - range.min) / (range.max - range.min);
	return MathUtils.getIntervalValue(
		ExpeditionConstants.COMPONENT_SCORE.MIN,
		ExpeditionConstants.COMPONENT_SCORE.MAX,
		percentage
	);
}

/**
 * Calculate the reward index (0-9) based on expedition parameters
 * Each component (duration, risk, difficulty) is scored 0-3 on a linear scale
 * Wealth rate applies a ±30% bonus/malus to the final index
 *
 * @param expedition Expedition input data used to compute the index
 * @returns reward index between 0 and 9
 */
export function calculateRewardIndex(expedition: ExpeditionData): number {
	// Calculate linear scores for each component (0-3 each)
	const durationScore = calculateLinearScore({
		value: expedition.durationMinutes,
		min: ExpeditionConstants.DURATION.MIN_MINUTES,
		max: ExpeditionConstants.DURATION.MAX_MINUTES
	});
	const riskScore = calculateLinearScore({
		value: expedition.riskRate,
		min: ExpeditionConstants.RISK_RATE.MIN,
		max: ExpeditionConstants.RISK_RATE.MAX
	});
	const difficultyScore = calculateLinearScore({
		value: expedition.difficulty,
		min: ExpeditionConstants.DIFFICULTY.MIN,
		max: ExpeditionConstants.DIFFICULTY.MAX
	});

	/*
	 * Sum the three scores with duration having a bonus weight
	 * Duration (0-3) * DURATION_WEIGHT + Risk (0-3) + Difficulty (0-3)
	 */
	const baseIndex = (durationScore * ExpeditionConstants.REWARD_INDEX.DURATION_WEIGHT) + riskScore + difficultyScore;

	/*
	 * Apply wealth rate bonus/malus (±30%)
	 * wealthRate goes from 0 to 2, with NEUTRAL_WEALTH_RATE being neutral
	 * At 0: -30%, at 1: 0%, at 2: +30%
	 */
	const wealthRateMultiplier = ExpeditionConstants.NEUTRAL_WEALTH_RATE
		+ (expedition.wealthRate - ExpeditionConstants.NEUTRAL_WEALTH_RATE) * ExpeditionConstants.WEALTH_RATE_REWARD_INDEX_BONUS;
	const adjustedIndex = baseIndex * wealthRateMultiplier;

	// Round, apply base offset, and clamp to REWARD_INDEX range (minimum 0)
	const rawIndex = Math.round(adjustedIndex) - ExpeditionConstants.REWARD_INDEX.BASE_OFFSET;
	return Math.max(
		ExpeditionConstants.REWARD_INDEX.MIN,
		Math.min(ExpeditionConstants.REWARD_INDEX.MAX, rawIndex)
	);
}

/**
 * Calculate base rewards from expedition parameters
 * Note: wealthRate is already factored into rewardIndex, so we don't multiply here
 */
function calculateBaseRewards(rewardIndex: number, locationType: ExpeditionLocationType): BaseRewards {
	const locationWeights = ExpeditionConstants.LOCATION_REWARD_WEIGHTS[locationType];

	return {
		money: Math.round(ExpeditionConstants.REWARD_TABLES.MONEY[rewardIndex] * locationWeights.money),
		experience: Math.round(ExpeditionConstants.REWARD_TABLES.EXPERIENCE[rewardIndex] * locationWeights.experience),
		points: Math.round(ExpeditionConstants.REWARD_TABLES.POINTS[rewardIndex] * locationWeights.points)
	};
}

/**
 * Apply partial success penalty (divides all rewards by penalty divisor)
 */
function applyPartialSuccessPenalty(rewards: BaseRewards): void {
	const divisor = ExpeditionConstants.PARTIAL_SUCCESS_PENALTY_DIVISOR;
	rewards.money = Math.round(rewards.money / divisor);
	rewards.experience = Math.round(rewards.experience / divisor);
	rewards.points = Math.round(rewards.points / divisor);
}

/**
 * Calculate chance and roll for clone talisman drop
 */
function rollCloneTalisman(params: CloneTalismanDropParams): boolean {
	const {
		expedition, rewardIndex, hasCloneTalisman, isPartialSuccess
	} = params;

	// No drop if player already has it or partial success
	if (hasCloneTalisman || isPartialSuccess) {
		return false;
	}

	// No drop if expedition has bonus tokens (mutually exclusive)
	if (expedition.hasBonusTokens) {
		return false;
	}

	let dropChance = ExpeditionConstants.CLONE_TALISMAN.BASE_DROP_CHANCE
		+ rewardIndex * ExpeditionConstants.CLONE_TALISMAN.REWARD_INDEX_BONUS_PER_POINT;

	// Apply bonus expedition multiplier if this expedition has the special tag
	if (expedition.hasCloneTalismanBonus) {
		dropChance *= ExpeditionConstants.CLONE_TALISMAN.BONUS_EXPEDITION_MULTIPLIER;
	}

	return RandomUtils.crowniclesRandom.bool(dropChance / 100);
}

/**
 * Calculate item rarity range based on reward index
 * minRarity = max(1, rewardIndex - 4)
 * maxRarity depends on reward index:
 * - rewardIndex <= 1: maxRarity = 5 (SPECIAL)
 * - rewardIndex = 2: maxRarity = 6 (EPIC)
 * - rewardIndex = 3: maxRarity = 7 (LEGENDARY)
 * - rewardIndex >= 4: maxRarity = 8 (MYTHICAL)
 */
function calculateItemRarityRange(rewardIndex: number): RarityRange {
	const minRarity = Math.max(
		ExpeditionConstants.ITEM_REWARD.MIN_RARITY_FLOOR,
		rewardIndex - ExpeditionConstants.ITEM_REWARD.MIN_RARITY_OFFSET
	);

	const maxRarity = ExpeditionConstants.ITEM_REWARD.MAX_RARITY_BY_REWARD_INDEX[rewardIndex];

	return {
		minRarity, maxRarity
	};
}

/**
 * Generate a random item reward based on reward index
 */
function generateItemReward(rewardIndex: number): ItemReward {
	const rarityRange = calculateItemRarityRange(rewardIndex);

	const item = generateRandomItem({
		minRarity: rarityRange.minRarity,
		maxRarity: rarityRange.maxRarity
	});

	return {
		itemId: item.id,
		itemCategory: item.getCategory()
	};
}

/**
 * Calculate rewards based on expedition parameters and location
 */
export function calculateRewards(params: RewardCalculationParams): ExpeditionRewardDataWithItem {
	const {
		expedition, rewardIndex, isPartialSuccess, hasCloneTalisman, playerCurrentTokens
	} = params;
	const rewards = calculateBaseRewards(rewardIndex, expedition.locationType);
	const tokens = calculateTokensReward(rewardIndex, expedition.hasBonusTokens ?? false, playerCurrentTokens);

	if (isPartialSuccess) {
		applyPartialSuccessPenalty(rewards);
	}

	// Generate random item reward (always given on success)
	const itemReward = generateItemReward(rewardIndex);

	return {
		...rewards,
		itemId: itemReward.itemId,
		itemCategory: itemReward.itemCategory,
		tokens,
		cloneTalismanFound: rollCloneTalisman({
			expedition,
			rewardIndex,
			hasCloneTalisman,
			isPartialSuccess
		})
	};
}
