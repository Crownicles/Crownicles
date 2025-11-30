import {
	ExpeditionData, ExpeditionRewardData
} from "../../../../Lib/src/packets/commands/CommandPetExpeditionPacket";
import { ExpeditionConstants } from "../../../../Lib/src/constants/ExpeditionConstants";
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
 * Calculate a linear score (0-3) based on how close a value is to its maximum
 * @param value Current value
 * @param min Minimum possible value
 * @param max Maximum possible value
 * @returns Score between 0 and 3
 */
function calculateLinearScore(value: number, min: number, max: number): number {
	const percentage = (value - min) / (max - min);
	return MathUtils.getIntervalValue(0, 3, percentage);
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
	const durationScore = calculateLinearScore(
		expedition.durationMinutes,
		ExpeditionConstants.DURATION.MIN_MINUTES,
		ExpeditionConstants.DURATION.MAX_MINUTES
	);
	const riskScore = calculateLinearScore(
		expedition.riskRate,
		ExpeditionConstants.RISK_RATE.MIN,
		ExpeditionConstants.RISK_RATE.MAX
	);
	const difficultyScore = calculateLinearScore(
		expedition.difficulty,
		ExpeditionConstants.DIFFICULTY.MIN,
		ExpeditionConstants.DIFFICULTY.MAX
	);

	/*
	 * Sum the three scores with duration having a bonus weight
	 * Duration (0-3) * 3 + Risk (0-3) + Difficulty (0-3)
	 */
	const baseIndex = (durationScore * 3) + riskScore + difficultyScore;

	/*
	 * Apply wealth rate bonus/malus (±30%)
	 * wealthRate goes from 0 to 2, with 1 being neutral
	 * At 0: -30%, at 1: 0%, at 2: +30%
	 */
	const wealthRateMultiplier = 1 + (expedition.wealthRate - 1) * ExpeditionConstants.WEALTH_RATE_REWARD_INDEX_BONUS;
	const adjustedIndex = baseIndex * wealthRateMultiplier;

	// Round and clamp to 0-9
	return Math.max(0, Math.min(9, Math.round(adjustedIndex)));
}

/**
 * Calculate base rewards from expedition parameters
 * Note: wealthRate is already factored into rewardIndex, so we don't multiply here
 */
function calculateBaseRewards(rewardIndex: number, locationType: string): {
	money: number;
	experience: number;
	points: number;
} {
	const locationWeights = ExpeditionConstants.LOCATION_REWARD_WEIGHTS[locationType];

	return {
		money: Math.round(ExpeditionConstants.REWARD_TABLES.MONEY[rewardIndex] * locationWeights.money),
		experience: Math.round(ExpeditionConstants.REWARD_TABLES.EXPERIENCE[rewardIndex] * locationWeights.experience),
		points: Math.round(ExpeditionConstants.REWARD_TABLES.POINTS[rewardIndex] * locationWeights.points)
	};
}

/**
 * Apply partial success penalty (halves all rewards)
 */
function applyPartialSuccessPenalty(rewards: {
	money: number;
	experience: number;
	points: number;
}): void {
	rewards.money = Math.round(rewards.money / 2);
	rewards.experience = Math.round(rewards.experience / 2);
	rewards.points = Math.round(rewards.points / 2);
}

/**
 * Calculate chance and roll for clone talisman drop
 */
function rollCloneTalisman(
	expedition: ExpeditionData,
	rewardIndex: number,
	hasCloneTalisman: boolean,
	isPartialSuccess: boolean
): boolean {
	// No drop if player already has it or partial success
	if (hasCloneTalisman || isPartialSuccess) {
		return false;
	}

	let dropChance = ExpeditionConstants.CLONE_TALISMAN.BASE_DROP_CHANCE
		+ rewardIndex * ExpeditionConstants.CLONE_TALISMAN.REWARD_INDEX_BONUS_PER_POINT;

	// Apply location bonus for special locations
	if ((ExpeditionConstants.CLONE_TALISMAN.BONUS_LOCATIONS as readonly string[]).includes(expedition.locationType)) {
		dropChance *= ExpeditionConstants.CLONE_TALISMAN.LOCATION_BONUS_MULTIPLIER;
	}

	// Apply bonus expedition multiplier if this expedition has the special tag
	if (expedition.hasCloneTalismanBonus) {
		dropChance *= ExpeditionConstants.CLONE_TALISMAN.BONUS_EXPEDITION_MULTIPLIER;
	}

	return RandomUtils.crowniclesRandom.bool(dropChance / 100);
}

/**
 * Calculate item rarity range based on reward index
 * minRarity = max(1, rewardIndex - 3)
 * maxRarity depends on reward index:
 * - rewardIndex <= 1: maxRarity = 5 (SPECIAL)
 * - rewardIndex = 2: maxRarity = 6 (EPIC)
 * - rewardIndex = 3: maxRarity = 7 (LEGENDARY)
 * - rewardIndex >= 4: maxRarity = 8 (MYTHICAL)
 */
function calculateItemRarityRange(rewardIndex: number): {
	minRarity: number; maxRarity: number;
} {
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
function generateItemReward(rewardIndex: number): {
	itemId: number; itemCategory: number;
} {
	const {
		minRarity, maxRarity
	} = calculateItemRarityRange(rewardIndex);

	const item = generateRandomItem({
		minRarity,
		maxRarity
	});

	return {
		itemId: item.id,
		itemCategory: item.getCategory()
	};
}

/**
 * Calculate rewards based on expedition parameters and location
 */
export function calculateRewards(
	expedition: ExpeditionData,
	rewardIndex: number,
	isPartialSuccess: boolean,
	hasCloneTalisman: boolean
): ExpeditionRewardDataWithItem {
	const rewards = calculateBaseRewards(rewardIndex, expedition.locationType);

	if (isPartialSuccess) {
		applyPartialSuccessPenalty(rewards);
	}

	// Generate random item reward (always given on success)
	const itemReward = generateItemReward(rewardIndex);

	return {
		...rewards,
		itemId: itemReward.itemId,
		itemCategory: itemReward.itemCategory,
		cloneTalismanFound: rollCloneTalisman(expedition, rewardIndex, hasCloneTalisman, isPartialSuccess)
	};
}
