import { fromServerTranslator } from "../FromServerTranslator";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandMissionShopAlreadyBoughtPointsThisWeek,
	CommandMissionShopAlreadyHadBadge,
	CommandMissionShopBadge,
	CommandMissionShopKingsFavor,
	CommandMissionShopMarketAnalysis,
	CommandMissionShopMoney,
	CommandMissionShopNoMissionToSkip,
	CommandMissionShopNoPet,
	CommandMissionShopPetInformation,
	CommandMissionShopSkipMissionResult,
	MarketTrend
} from "../../../../../Lib/src/packets/commands/CommandMissionShopPacket";
import {
	CommandShopAlreadyHaveBadge,
	CommandShopBadgeBought,
	CommandShopBoughtTooMuchDailyPotions,
	CommandShopGenericPurchase,
	CommandShopNoGardenForRemoteHarvestTalisman,
	CommandShopNoPlantSlotAvailable,
	CommandShopNotEnoughCurrency
} from "../../../../../Lib/src/packets/interaction/ReactionCollectorShop";
import { Badge } from "../../../../../Lib/src/types/Badge";
import { ReactionCollectorBuyCategorySlotBuySuccess } from "../../../../../Lib/src/packets/interaction/ReactionCollectorBuyCategorySlot";
import {
	MARKET_TRENDS, MarketTrendKind, PlantForecast, ShopNoPetRes, ShopOutcome, ShopOutcomeRes, ShopPetCheckupRes
} from "../../../../../WsPackets/src/fromServer/shop/ShopRes";
import { missionData } from "../MissionDisplay";
import { PetSex } from "../../../../../WsPackets/src/objects/OwnedPet";
import { PetConstants } from "../../../../../Lib/src/constants/PetConstants";
import { shopItemTypeToId } from "../../../../../Lib/src/utils/ShopUtils";
import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";

const TRENDS: Record<MarketTrend, MarketTrendKind> = {
	[MarketTrend.NON_APPLICABLE]: MARKET_TRENDS.NON_APPLICABLE,
	[MarketTrend.BIG_DROP]: MARKET_TRENDS.BIG_DROP,
	[MarketTrend.DROP]: MARKET_TRENDS.DROP,
	[MarketTrend.STABLE]: MARKET_TRENDS.STABLE,
	[MarketTrend.RISE]: MARKET_TRENDS.RISE,
	[MarketTrend.BIG_RISE]: MARKET_TRENDS.BIG_RISE
};

function trends(values: MarketTrend[]): MarketTrendKind[] {
	return values.map(value => TRENDS[value] ?? MARKET_TRENDS.STABLE);
}

function forecasts(values: {
	plantId: number; trends: MarketTrend[];
}[]): PlantForecast[] {
	return values.map(forecast => ({
		plantId: forecast.plantId,
		trends: trends(forecast.trends)
	}));
}

function outcome(value: ShopOutcome): Promise<ShopOutcomeRes> {
	return asyncMakeFromServerPacket(ShopOutcomeRes, { outcome: value });
}

/** Every answer a commerce can give, so a purchase never ends in silence. */
export default class ShopServerTranslator {
	@fromServerTranslator(CommandShopGenericPurchase, ShopOutcomeRes)
	public static purchased(_context: PacketContext, packet: CommandShopGenericPurchase): Promise<ShopOutcomeRes> {
		return outcome({
			kind: "purchase",
			shopItemId: shopItemTypeToId(packet.shopItemId),
			amount: packet.amount,
			...packet.materials === undefined ? {} : { materials: packet.materials },
			...packet.translationParams === undefined ? {} : { translationParams: packet.translationParams }
		});
	}

	@fromServerTranslator(CommandShopNotEnoughCurrency, ShopOutcomeRes)
	public static tooPoor(_context: PacketContext, packet: CommandShopNotEnoughCurrency): Promise<ShopOutcomeRes> {
		return outcome({
			kind: "notEnoughCurrency",
			missingCurrency: packet.missingCurrency,
			currency: packet.currency
		});
	}

	@fromServerTranslator(ReactionCollectorBuyCategorySlotBuySuccess, ShopOutcomeRes)
	public static slotBought(_context: PacketContext, _packet: ReactionCollectorBuyCategorySlotBuySuccess): Promise<ShopOutcomeRes> {
		return outcome({ kind: "slotBought" });
	}

	@fromServerTranslator(CommandShopBoughtTooMuchDailyPotions, ShopOutcomeRes)
	public static potionsExhausted(_context: PacketContext, _packet: CommandShopBoughtTooMuchDailyPotions): Promise<ShopOutcomeRes> {
		return outcome({ kind: "tooManyDailyPotions" });
	}

	@fromServerTranslator(CommandShopNoPlantSlotAvailable, ShopOutcomeRes)
	public static noPlantSlot(_context: PacketContext, _packet: CommandShopNoPlantSlotAvailable): Promise<ShopOutcomeRes> {
		return outcome({ kind: "noPlantSlot" });
	}

	@fromServerTranslator(CommandShopNoGardenForRemoteHarvestTalisman, ShopOutcomeRes)
	public static noGarden(_context: PacketContext, _packet: CommandShopNoGardenForRemoteHarvestTalisman): Promise<ShopOutcomeRes> {
		return outcome({ kind: "noGardenForTalisman" });
	}

	@fromServerTranslator(CommandShopBadgeBought, ShopOutcomeRes)
	public static badgeBought(_context: PacketContext, _packet: CommandShopBadgeBought): Promise<ShopOutcomeRes> {
		return outcome({
			kind: "badge", badgeId: Badge.RICH
		});
	}

	@fromServerTranslator(CommandShopAlreadyHaveBadge, ShopOutcomeRes)
	public static alreadyRich(_context: PacketContext, _packet: CommandShopAlreadyHaveBadge): Promise<ShopOutcomeRes> {
		return outcome({ kind: "alreadyHasBadge" });
	}

	@fromServerTranslator(CommandMissionShopMoney, ShopOutcomeRes)
	public static kingsMoney(_context: PacketContext, packet: CommandMissionShopMoney): Promise<ShopOutcomeRes> {
		return outcome({
			kind: "money", amount: packet.amount
		});
	}

	@fromServerTranslator(CommandMissionShopKingsFavor, ShopOutcomeRes)
	public static kingsFavor(_context: PacketContext, packet: CommandMissionShopKingsFavor): Promise<ShopOutcomeRes> {
		return outcome({
			kind: "kingsFavor", thousandPoints: packet.amount
		});
	}

	@fromServerTranslator(CommandMissionShopAlreadyBoughtPointsThisWeek, ShopOutcomeRes)
	public static favorAlreadyBought(_context: PacketContext, _packet: CommandMissionShopAlreadyBoughtPointsThisWeek): Promise<ShopOutcomeRes> {
		return outcome({ kind: "alreadyBoughtPointsThisWeek" });
	}

	@fromServerTranslator(CommandMissionShopSkipMissionResult, ShopOutcomeRes)
	public static missionSkipped(_context: PacketContext, packet: CommandMissionShopSkipMissionResult): Promise<ShopOutcomeRes> {
		return outcome({
			kind: "missionSkipped",
			oldMission: missionData(packet.oldMission),
			newMission: missionData(packet.newMission)
		});
	}

	@fromServerTranslator(CommandMissionShopNoMissionToSkip, ShopOutcomeRes)
	public static noMissionToSkip(_context: PacketContext, _packet: CommandMissionShopNoMissionToSkip): Promise<ShopOutcomeRes> {
		return outcome({ kind: "noMissionToSkip" });
	}

	@fromServerTranslator(CommandMissionShopBadge, ShopOutcomeRes)
	public static questMasterBadge(_context: PacketContext, _packet: CommandMissionShopBadge): Promise<ShopOutcomeRes> {
		return outcome({
			kind: "badge", badgeId: Badge.MISSION_COMPLETER
		});
	}

	@fromServerTranslator(CommandMissionShopAlreadyHadBadge, ShopOutcomeRes)
	public static alreadyQuestMaster(_context: PacketContext, _packet: CommandMissionShopAlreadyHadBadge): Promise<ShopOutcomeRes> {
		return outcome({ kind: "alreadyHasBadge" });
	}

	@fromServerTranslator(CommandMissionShopMarketAnalysis, ShopOutcomeRes)
	public static marketAnalysis(_context: PacketContext, packet: CommandMissionShopMarketAnalysis): Promise<ShopOutcomeRes> {
		return outcome({
			kind: "marketAnalysis",
			kingsMoneyTrends: trends(packet.kingsMoneyTrends),
			plantTrends: forecasts(packet.plantTrends),
			...packet.plantRotation
				? { plantRotation: {
					daysUntilRotation: packet.plantRotation.daysUntilRotation,
					newPlantIds: [...packet.plantRotation.newPlantIds],
					newPlantForecasts: forecasts(packet.plantRotation.newPlantForecasts)
				} }
				: {}
		});
	}

	@fromServerTranslator(CommandMissionShopPetInformation, ShopPetCheckupRes)
	public static checkup(_context: PacketContext, packet: CommandMissionShopPetInformation): Promise<ShopPetCheckupRes> {
		return asyncMakeFromServerPacket(ShopPetCheckupRes, {
			typeId: packet.typeId,
			petId: packet.petId,
			sex: packet.sex as PetSex,
			loveLevel: packet.loveLevel,
			lovePoints: packet.lovePoints,
			maxLovePoints: PetConstants.MAX_LOVE_POINTS,
			diet: packet.diet,
			ageCategory: packet.ageCategory,
			nextFeed: packet.nextFeed,
			feedDelay: packet.feedDelay,
			force: packet.force,
			speed: packet.speed,
			fightAssistId: packet.fightAssistId,
			...packet.nickname === null || packet.nickname === undefined ? {} : { nickname: packet.nickname },
			...packet.likedExpeditionTypes ? { likedExpeditionTypes: packet.likedExpeditionTypes } : {},
			...packet.dislikedExpeditionTypes ? { dislikedExpeditionTypes: packet.dislikedExpeditionTypes } : {},
			...packet.randomPetDwarf
				? { randomPetDwarf: {
					typeId: packet.randomPetDwarf.typeId,
					sex: packet.randomPetDwarf.sex as PetSex,
					numberOfPetsNotSeen: packet.randomPetDwarf.numberOfPetsNotSeen
				} }
				: {},
			...packet.lovePointsGained === undefined ? {} : { lovePointsGained: packet.lovePointsGained }
		});
	}

	@fromServerTranslator(CommandMissionShopNoPet, ShopNoPetRes)
	public static noPet(_context: PacketContext, _packet: CommandMissionShopNoPet): Promise<ShopNoPetRes> {
		return asyncMakeFromServerPacket(ShopNoPetRes, {});
	}
}
