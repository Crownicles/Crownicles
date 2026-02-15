import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	Player, Players
} from "../../core/database/game/models/Player";
import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import {
	CommandShopClosed, ShopCategory, ShopItem
} from "../../../../Lib/src/packets/interaction/ReactionCollectorShop";
import { ShopUtils } from "../../core/utils/ShopUtils";
import {
	CommandMissionShopAlreadyBoughtPointsThisWeek,
	CommandMissionShopAlreadyHadBadge,
	CommandMissionShopBadge,
	CommandMissionShopKingsFavor,
	CommandMissionShopMarketAnalysis,
	CommandMissionShopMoney,
	CommandMissionShopNoMissionToSkip,
	CommandMissionShopNoPet,
	CommandMissionShopPacketReq,
	CommandMissionShopPetInformation,
	CommandMissionShopSkipMissionResult,
	MarketTrend
} from "../../../../Lib/src/packets/commands/CommandMissionShopPacket";
import { BlessingManager } from "../../core/blessings/BlessingManager";
import { ShopCurrency } from "../../../../Lib/src/constants/ShopConstants";
import { Constants } from "../../../../Lib/src/constants/Constants";
import { getDayNumber } from "../../../../Lib/src/utils/TimeUtils";
import {
	NumberChangeReason, ShopItemType
} from "../../../../Lib/src/constants/LogsConstants";
import { MissionsController } from "../../core/missions/MissionsController";
import { crowniclesInstance } from "../../index";
import {
	generateRandomItem, giveItemToPlayer
} from "../../core/utils/ItemUtils";
import { ItemRarity } from "../../../../Lib/src/constants/ItemConstants";
import { PlayerMissionsInfos } from "../../core/database/game/models/PlayerMissionsInfo";
import { PetEntities } from "../../core/database/game/models/PetEntity";
import { PetDataController } from "../../data/Pet";
import {
	MissionSlot, MissionSlots
} from "../../core/database/game/models/MissionSlot";
import { ReactionCollectorInstance } from "../../core/utils/ReactionsCollector";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import { BlockingUtils } from "../../core/utils/BlockingUtils";
import {
	ReactionCollectorSkipMissionShopItem,
	ReactionCollectorSkipMissionShopItemCloseReaction,
	ReactionCollectorSkipMissionShopItemReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorSkipMissionShopItem";
import {
	PetConstants, PetDiet
} from "../../../../Lib/src/constants/PetConstants";
import { SexTypeShort } from "../../../../Lib/src/constants/StringConstants";
import { WhereAllowed } from "../../../../Lib/src/types/WhereAllowed";
import { getAiPetBehavior } from "../../core/fights/PetAssistManager";
import { PetUtils } from "../../core/utils/PetUtils";
import { Badge } from "../../../../Lib/src/types/Badge";
import { DwarfPetsSeen } from "../../core/database/game/models/DwarfPetsSeen";
import { PlayerBadgesManager } from "../../core/database/game/models/PlayerBadges";
import { getPetExpeditionPreferences } from "../../../../Lib/src/constants/ExpeditionConstants";
import {
	PlantConstants, PlantId, PlantType
} from "../../../../Lib/src/constants/PlantConstants";
import { TimeConstants } from "../../../../Lib/src/constants/TimeConstants";

/**
 * Calculate the amount of money the player will have if he buys some with gems
 */
function calculateGemsToMoneyRatio(dayOffset: number = 0): number {
	/**
	 * Returns the decimal part of a number
	 * @param x
	 */
	const frac = function(x: number): number {
		return x >= 0 ? x % 1 : 1 + x % 1;
	};
	return Constants.MISSION_SHOP.BASE_RATIO
		+ Math.round(Constants.MISSION_SHOP.RANGE_MISSION_MONEY * 2
			* frac(100 * Math.sin(Constants.MISSION_SHOP.SIN_RANDOMIZER * ((getDayNumber() + dayOffset) % Constants.MISSION_SHOP.SEED_RANGE) + 1))
			- Constants.MISSION_SHOP.RANGE_MISSION_MONEY);
}

/**
 * Creates the money shop item configuration
 * @returns Shop item for purchasing money with gems
 */
function getMoneyShopItem(): ShopItem {
	return {
		id: ShopItemType.MONEY,
		price: Constants.MISSION_SHOP.PRICES.MONEY,
		amounts: [1],
		buyCallback: async (response: CrowniclesPacket[], playerId: number): Promise<boolean> => {
			const player = await Players.getById(playerId);
			const amount = calculateGemsToMoneyRatio();
			await player.addMoney({
				amount,
				response,
				reason: NumberChangeReason.MISSION_SHOP
			});
			await player.save();
			if (amount < Constants.MISSION_SHOP.KINGS_MONEY_VALUE_THRESHOLD_MISSION) {
				await MissionsController.update(player, response, { missionId: "kingsMoneyValue" });
			}
			response.push(makePacket(CommandMissionShopMoney, {
				amount: BlessingManager.getInstance().applyMoneyBlessing(amount)
			}));
			return true;
		}
	};
}

/**
 * Creates the valuable item shop item configuration
 * @returns Shop item for purchasing a random rare item
 */
function getValuableItemShopItem(): ShopItem {
	return {
		id: ShopItemType.TREASURE,
		price: Constants.MISSION_SHOP.PRICES.VALUABLE_ITEM,
		amounts: [1],
		buyCallback: async (response: CrowniclesPacket[], playerId: number, context: PacketContext): Promise<boolean> => {
			const player = await Players.getById(playerId);
			const item = generateRandomItem({
				minRarity: ItemRarity.SPECIAL
			});
			await giveItemToPlayer(response, context, player, item);
			return true;
		}
	};
}

/**
 * Creates the thousand points shop item configuration
 * @returns Shop item for purchasing score points (king's favor)
 */
function getAThousandPointsShopItem(): ShopItem {
	return {
		id: ShopItemType.KINGS_FAVOR,
		price: Constants.MISSION_SHOP.PRICES.THOUSAND_POINTS,
		amounts: [1],
		buyCallback: async (response: CrowniclesPacket[], playerId: number): Promise<boolean> => {
			const player = await Players.getById(playerId);
			const missionsInfo = await PlayerMissionsInfos.getOfPlayer(player.id);
			if (missionsInfo.hasBoughtPointsThisWeek) {
				response.push(makePacket(CommandMissionShopAlreadyBoughtPointsThisWeek, {}));
				return false;
			}
			await player.addScore({
				amount: Constants.MISSION_SHOP.THOUSAND_POINTS,
				response,
				reason: NumberChangeReason.MISSION_SHOP
			});
			missionsInfo.hasBoughtPointsThisWeek = true;
			response.push(makePacket(CommandMissionShopKingsFavor, {}));
			await Promise.all([player.save(), missionsInfo.save()]);
			return true;
		}
	};
}

/**
 * Creates the pet information shop item configuration
 * @returns Shop item for viewing detailed pet information and preferences
 */
function getValueLovePointsPetShopItem(): ShopItem {
	return {
		id: ShopItemType.LOVE_POINTS_VALUE,
		price: Constants.MISSION_SHOP.PRICES.PET_INFORMATION,
		amounts: [1],
		buyCallback: async (response: CrowniclesPacket[], playerId: number): Promise<boolean> => {
			const player = await Players.getById(playerId);
			if (player.petId === null) {
				response.push(makePacket(CommandMissionShopNoPet, {}));
				return false;
			}
			const pet = await PetEntities.getById(player.petId);
			if (!pet) {
				response.push(makePacket(CommandMissionShopNoPet, {}));
				return false;
			}
			const petModel = PetDataController.instance.getById(pet.typeId)!;
			const randomPetNotShownToDwarfId = await DwarfPetsSeen.getRandomPetNotSeenId(player);
			const randomPetDwarfModel = randomPetNotShownToDwarfId !== 0 ? PetDataController.instance.getById(randomPetNotShownToDwarfId) : null;

			// Get pet expedition preferences
			const preferences = getPetExpeditionPreferences(pet.typeId);
			const likedExpeditionTypes = preferences?.liked ? [...preferences.liked] : [];
			const dislikedExpeditionTypes = preferences?.disliked ? [...preferences.disliked] : [];

			response.push(makePacket(CommandMissionShopPetInformation, {
				nickname: pet.nickname,
				petId: pet.id,
				typeId: petModel.id,
				sex: pet.sex as SexTypeShort,
				loveLevel: pet.getLoveLevelNumber(),
				lovePoints: pet.lovePoints,
				diet: petModel.diet as PetDiet,
				nextFeed: pet.getFeedCooldown(petModel),
				force: petModel.force,
				speed: petModel.speed,
				feedDelay: (petModel.feedDelay ?? 1) * PetConstants.BREED_COOLDOWN,
				fightAssistId: getAiPetBehavior(petModel.id)?.id ?? "",
				ageCategory: PetUtils.getAgeCategory(pet.id),
				likedExpeditionTypes,
				dislikedExpeditionTypes,
				...randomPetDwarfModel && {
					randomPetDwarf: {
						typeId: randomPetDwarfModel.id,
						sex: PetConstants.SEX.MALE as SexTypeShort,
						numberOfPetsNotSeen: await DwarfPetsSeen.getNumberOfPetsNotSeen(player)
					}
				}
			}));
			return true;
		}
	};
}

/**
 * Creates the end callback for the skip mission shop item
 * @param player - The player who is skipping the mission
 * @param missionList - The list of missions available to skip
 * @returns Callback function to handle mission skip completion
 */
function getEndCallbackSkipMissionShopItem(player: Player, missionList: MissionSlot[]): (collector: ReactionCollectorInstance, response: CrowniclesPacket[]) => Promise<void> {
	return async (collector: ReactionCollectorInstance, response: CrowniclesPacket[]) => {
		const firstReaction = collector.getFirstReaction();
		BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.SKIP_MISSION);
		if (!firstReaction || firstReaction.reaction.type === ReactionCollectorSkipMissionShopItemCloseReaction.name) {
			response.push(makePacket(CommandShopClosed, {}));
			return;
		}
		const missionIndex: number = (firstReaction.reaction.data as ReactionCollectorSkipMissionShopItemReaction).missionIndex;
		const mission = missionList[missionIndex];
		await mission.destroy();
		const newMission = await MissionsController.addRandomMissionToPlayer(player, MissionsController.getRandomDifficulty(player), mission.missionId);
		response.push(makePacket(CommandMissionShopSkipMissionResult, {
			oldMission: MissionsController.prepareMissionSlot(mission),
			newMission: MissionsController.prepareMissionSlot(newMission)
		}));
		const playerMissionsInfo = await PlayerMissionsInfos.getOfPlayer(player.id);
		await playerMissionsInfo.spendGems(Constants.MISSION_SHOP.PRICES.MISSION_SKIP, response, NumberChangeReason.MISSION_SHOP);
	};
}

/**
 * Creates the skip mission shop item configuration
 * @returns Shop item for skipping and replacing a current mission
 */
function getSkipMapMissionShopItem(): ShopItem {
	return {
		id: ShopItemType.SKIP_MISSION,
		price: Constants.MISSION_SHOP.PRICES.MISSION_SKIP,
		amounts: [1],
		buyCallback: async (response: CrowniclesPacket[], playerId: number, context: PacketContext): Promise<boolean> => {
			const player = await Players.getById(playerId);
			const missionSlots = await MissionSlots.getOfPlayer(player.id);
			const allMissions = missionSlots.filter(slot => !slot.isCampaign());
			if (!allMissions.length) {
				response.push(makePacket(CommandMissionShopNoMissionToSkip, {}));
				return false;
			}

			const baseMissions = MissionsController.prepareMissionSlots(allMissions);

			const collector = new ReactionCollectorSkipMissionShopItem(baseMissions);

			// Create a reaction collector which will let the player choose the mission he wants to skip
			const packet = new ReactionCollectorInstance(
				collector,
				context,
				{
					allowedPlayerKeycloakIds: [player.keycloakId]
				},
				getEndCallbackSkipMissionShopItem(player, allMissions)
			)
				.block(player.keycloakId, BlockingConstants.REASONS.SKIP_MISSION)
				.build();

			response.push(packet);
			return false;
		}
	};
}

/**
 * Creates the badge shop item configuration
 * @returns Shop item for purchasing the quest master badge
 */
function getBadgeShopItem(): ShopItem {
	return {
		id: ShopItemType.QUEST_MASTER_BADGE,
		price: Constants.MISSION_SHOP.PRICES.BADGE,
		amounts: [1],
		buyCallback: async (response: CrowniclesPacket[], playerId: number): Promise<boolean> => {
			const player = await Players.getById(playerId);
			if (await PlayerBadgesManager.hasBadge(player.id, Badge.MISSION_COMPLETER)) {
				response.push(makePacket(CommandMissionShopAlreadyHadBadge, {}));
				return false;
			}
			await PlayerBadgesManager.addBadge(player.id, Badge.MISSION_COMPLETER);
			response.push(makePacket(CommandMissionShopBadge, {}));
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
 * Day offsets for market analysis forecasts
 */
const FORECAST_OFFSETS: [number, number, number] = [
	1,
	3,
	7
];

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
function getMarketAnalysisShopItem(): ShopItem {
	return {
		id: ShopItemType.MARKET_ANALYSIS,
		price: Constants.MISSION_SHOP.PRICES.MARKET_ANALYSIS,
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

export default class MissionShopCommand {
	@commandRequires(CommandMissionShopPacketReq, {
		notBlocked: true,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD_OR_JAILED,
		whereAllowed: [WhereAllowed.CONTINENT]
	})
	static async execute(
		response: CrowniclesPacket[],
		player: Player,
		_packet: CommandMissionShopPacketReq,
		context: PacketContext
	): Promise<void> {
		const shopCategories: ShopCategory[] = [];

		shopCategories.push(
			{
				id: "resources",
				items: [
					getMoneyShopItem(),
					getValuableItemShopItem(),
					getAThousandPointsShopItem()
				]
			},
			{
				id: "utilitaries",
				items: [
					getSkipMapMissionShopItem(),
					getValueLovePointsPetShopItem(),
					getMarketAnalysisShopItem()
				]
			},
			{
				id: "prestige",
				items: [getBadgeShopItem()]
			}
		);

		await ShopUtils.createAndSendShopCollector(context, response, {
			shopCategories,
			player,
			logger: crowniclesInstance?.logsDatabase.logMissionShopBuyout,
			additionalShopData: {
				currency: ShopCurrency.GEM,
				gemToMoneyRatio: calculateGemsToMoneyRatio()
			}
		});
	}
}
