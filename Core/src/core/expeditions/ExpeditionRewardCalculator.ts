import {
	ExpeditionData, ExpeditionRewardData
} from "../../../../Lib/src/packets/commands/CommandPetExpeditionPacket";
import { ExpeditionConstants } from "../../../../Lib/src/constants/ExpeditionConstants";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import {
	generateRandomItem
} from "../utils/ItemUtils";
import { ItemCategory } from "../../../../Lib/src/constants/ItemConstants";

/**
 * Return a 0..3 score for a numeric value based on 3 thresholds.
 *
 * The thresholds object contains values for SCORE_1..SCORE_3.
 * - returns 3 when value >= SCORE_3
 * - returns 2 when value >= SCORE_2
 * - returns 1 when value >= SCORE_1
 * - otherwise returns 0
 */
function getThresholdScore(
	value: number,
	thresholds: {
		SCORE_1: number;
		SCORE_2: number;
		SCORE_3: number;
	}
): number {
	if (value >= thresholds.SCORE_3) {
		return 3;
	}

	if (value >= thresholds.SCORE_2) {
		return 2;
	}

	if (value >= thresholds.SCORE_1) {
		return 1;
	}

	return 0;
}

/**
 * Calculate the reward index (0-9) based on expedition parameters
 * Higher index = better rewards
 *
 * @param expedition Expedition input data used to compute the index
 * @returns reward index between 0 and 9
 */
export function calculateRewardIndex(expedition: ExpeditionData): number {
	const thresholds = ExpeditionConstants.SCORE_THRESHOLDS;

	const durationScore = getThresholdScore(expedition.durationMinutes, thresholds.DURATION);
	const riskScore = getThresholdScore(expedition.riskRate, thresholds.RISK);
	const difficultyScore = getThresholdScore(expedition.difficulty, thresholds.DIFFICULTY);

	return Math.min(9, durationScore + riskScore + difficultyScore);
}

/**
 * Calculate base rewards from expedition parameters
 */
function calculateBaseRewards(expedition: ExpeditionData, rewardIndex: number): {
	money: number;
	experience: number;
	points: number;
} {
	const locationWeights = ExpeditionConstants.LOCATION_REWARD_WEIGHTS[expedition.locationType];

	return {
		money: Math.round(ExpeditionConstants.REWARD_TABLES.MONEY[rewardIndex] * expedition.wealthRate * locationWeights.money),
		experience: Math.round(ExpeditionConstants.REWARD_TABLES.EXPERIENCE[rewardIndex] * expedition.wealthRate * locationWeights.experience),
		points: Math.round(ExpeditionConstants.REWARD_TABLES.POINTS[rewardIndex] * expedition.wealthRate * locationWeights.points)
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

	// No cap on drop chance - removed MAX_DROP_CHANCE

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
function calculateItemRarityRange(rewardIndex: number): { minRarity: number; maxRarity: number } {
	const minRarity = Math.max(
		ExpeditionConstants.ITEM_REWARD.MIN_RARITY_FLOOR,
		rewardIndex - ExpeditionConstants.ITEM_REWARD.MIN_RARITY_OFFSET
	);

	const maxRarity = ExpeditionConstants.ITEM_REWARD.MAX_RARITY_BY_REWARD_INDEX[rewardIndex];

	return { minRarity, maxRarity };
}

/**
 * Generate a random item reward based on reward index
 */
function generateItemReward(rewardIndex: number): { itemId: number; itemCategory: number } {
	const { minRarity, maxRarity } = calculateItemRarityRange(rewardIndex);

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
): ExpeditionRewardData {
	const rewards = calculateBaseRewards(expedition, rewardIndex);

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
