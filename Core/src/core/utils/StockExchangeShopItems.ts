import {
	CommandShopAlreadyHaveBadge,
	CommandShopBadgeBought,
	ShopItem
} from "../../../../Lib/src/packets/interaction/ReactionCollectorShop";
import { ShopConstants } from "../../../../Lib/src/constants/ShopConstants";
import { ShopItemType } from "../../../../Lib/src/constants/LogsConstants";
import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { Badge } from "../../../../Lib/src/types/Badge";
import { PlayerBadgesManager } from "../database/game/models/PlayerBadges";
import {
	CommandMissionShopMarketAnalysis,
	MarketTrend
} from "../../../../Lib/src/packets/commands/CommandMissionShopPacket";
import {
	PlantConstants, PlantId, PlantType
} from "../../../../Lib/src/constants/PlantConstants";
import { TimeConstants } from "../../../../Lib/src/constants/TimeConstants";
import { calculateGemsToMoneyRatio } from "./MissionShopItems";

/**
 * Get the shop item for the money mouth badge
 */
export function getBadgeShopItem(): ShopItem {
	return {
		id: ShopItemType.MONEY_MOUTH_BADGE,
		price: ShopConstants.MONEY_MOUTH_BADGE_PRICE,
		amounts: [1],
		buyCallback: async (response, playerId): Promise<boolean> => {
			const hasBadge = await PlayerBadgesManager.hasBadge(playerId, Badge.RICH);
			if (hasBadge) {
				response.push(makePacket(CommandShopAlreadyHaveBadge, {}));
				return false;
			}
			await PlayerBadgesManager.addBadge(playerId, Badge.RICH);
			response.push(makePacket(CommandShopBadgeBought, {}));
			return true;
		}
	};
}

/**
 * Thresholds for trend classification (as percentage change)
 */
const TREND_THRESHOLDS = {
	BIG_CHANGE: 0.12,
	SMALL_CHANGE: 0.04
};

/**
 * Day offsets for market analysis forecasts
 */
const FORECAST_OFFSETS: [number, number, number] = [
	1,
	3,
	7
];

/**
 * Convert a percentage change to a MarketTrend enum value
 */
function percentageToTrend(percentChange: number): MarketTrend {
	if (percentChange <= -TREND_THRESHOLDS.BIG_CHANGE) {
		return MarketTrend.BIG_DROP;
	}
	if (percentChange <= -TREND_THRESHOLDS.SMALL_CHANGE) {
		return MarketTrend.DROP;
	}
	if (percentChange >= TREND_THRESHOLDS.BIG_CHANGE) {
		return MarketTrend.BIG_RISE;
	}
	if (percentChange >= TREND_THRESHOLDS.SMALL_CHANGE) {
		return MarketTrend.RISE;
	}
	return MarketTrend.STABLE;
}

/**
 * Check if two plant arrays contain the same plant IDs
 */
function samePlants(a: PlantType[], b: PlantType[]): boolean {
	return a.length === b.length && a.every((plant, i) => plant.id === b[i].id);
}

/**
 * Creates the market analysis shop item configuration
 * @returns Shop item for purchasing market trend analysis
 */
export function getMarketAnalysisShopItem(): ShopItem {
	return {
		id: ShopItemType.MARKET_ANALYSIS,
		price: ShopConstants.MARKET_ANALYSIS_PRICE,
		amounts: [1],
		buyCallback: (response: CrowniclesPacket[]): boolean => {
			const todayRatio = calculateGemsToMoneyRatio();
			const kingsMoneyTrends = FORECAST_OFFSETS.map(offset => {
				const futureRatio = calculateGemsToMoneyRatio(offset);
				return percentageToTrend((futureRatio - todayRatio) / todayRatio);
			}) as [MarketTrend, MarketTrend, MarketTrend];

			const now = new Date();
			const weeklyPlants = PlantConstants.getWeeklyHerbalistPlants(now);

			// Find the first horizon where plants rotate
			let rotationHorizonIndex: number | null = null;
			let newPlantIds: PlantId[] | null = null;
			for (let i = 0; i < FORECAST_OFFSETS.length; i++) {
				const futureDate = new Date(now.getTime() + FORECAST_OFFSETS[i] * TimeConstants.MS_TIME.DAY);
				const futurePlants = PlantConstants.getWeeklyHerbalistPlants(futureDate);
				if (!samePlants(weeklyPlants, futurePlants)) {
					rotationHorizonIndex = i;
					newPlantIds = futurePlants.map(p => p.id);
					break;
				}
			}

			// Build plant trends, setting null for horizons after rotation
			const plantTrends = weeklyPlants.map(plant => {
				const todayPrice = PlantConstants.getHerbalistPrice(plant);
				const trends = FORECAST_OFFSETS.map((offset, i) => {
					if (rotationHorizonIndex !== null && i >= rotationHorizonIndex) {
						return null;
					}
					const futurePrice = PlantConstants.getHerbalistPrice(plant, offset);
					return percentageToTrend((futurePrice - todayPrice) / todayPrice);
				}) as [MarketTrend | null, MarketTrend | null, MarketTrend | null];
				return {
					plantId: plant.id,
					trends
				};
			});

			const packetData: {
				kingsMoneyTrends: [MarketTrend, MarketTrend, MarketTrend];
				plantTrends: {
					plantId: PlantId; trends: [MarketTrend | null, MarketTrend | null, MarketTrend | null];
				}[];
				plantRotation?: {
					horizonIndex: number;
					newPlantIds: PlantId[];
					newPlantForecasts: {
						plantId: PlantId;
						trends: (MarketTrend | null)[];
					}[];
				};
			} = {
				kingsMoneyTrends,
				plantTrends
			};

			if (rotationHorizonIndex !== null && newPlantIds !== null) {
				/*
				 * Compute forecasts for new plants at post-rotation horizons.
				 * Compare each horizon's price to the plant's base price to indicate if it's above or below average.
				 */
				const futureDate = new Date(now.getTime() + FORECAST_OFFSETS[rotationHorizonIndex] * TimeConstants.MS_TIME.DAY);
				const newPlants = PlantConstants.getWeeklyHerbalistPlants(futureDate);
				const newPlantForecasts = newPlants.map(plant => {
					const basePrice = PlantConstants.HERBALIST_PRICES[plant.id - 1];
					const trends = FORECAST_OFFSETS.map((offset, i) => {
						if (i < rotationHorizonIndex!) {
							return null; // Plant not available yet
						}
						const futurePrice = PlantConstants.getHerbalistPrice(plant, offset);
						return percentageToTrend((futurePrice - basePrice) / basePrice);
					});
					return {
						plantId: plant.id,
						trends
					};
				});

				packetData.plantRotation = {
					horizonIndex: rotationHorizonIndex,
					newPlantIds,
					newPlantForecasts
				};
			}

			response.push(makePacket(CommandMissionShopMarketAnalysis, packetData));
			return true;
		}
	};
}
