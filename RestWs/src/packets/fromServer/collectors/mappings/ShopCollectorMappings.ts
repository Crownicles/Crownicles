import {
	ReactionCollectorShopCloseReaction,
	ReactionCollectorShopData,
	ReactionCollectorShopItemReaction
} from "../../../../../../Lib/src/packets/interaction/ReactionCollectorShop";
import {
	ReactionCollectorSkipMissionShopItemCloseReaction,
	ReactionCollectorSkipMissionShopItemData,
	ReactionCollectorSkipMissionShopItemReaction
} from "../../../../../../Lib/src/packets/interaction/ReactionCollectorSkipMissionShopItem";
import {
	ReactionCollectorBuyCategorySlotCancelReaction,
	ReactionCollectorBuyCategorySlotData,
	ReactionCollectorBuyCategorySlotReaction
} from "../../../../../../Lib/src/packets/interaction/ReactionCollectorBuyCategorySlot";
import {
	SHOP_DATA_KINDS, SHOP_REACTION_KINDS
} from "../../../../../../WsPackets/src/fromServer/collectors";
import {
	DataMapping, defineDataMapping, defineReactionMapping, ReactionMapping
} from "../CollectorMapping";
import { missionData } from "../../translators/MissionsCommandServerTranslator";

export const shopReactionMappings: ReactionMapping[] = [
	defineReactionMapping(ReactionCollectorShopItemReaction, SHOP_REACTION_KINDS.ITEM, reaction => ({
		shopCategoryId: reaction.shopCategoryId,
		shopItemId: reaction.shopItemId,
		price: reaction.price,
		amount: reaction.amount
	})),
	defineReactionMapping(ReactionCollectorShopCloseReaction, SHOP_REACTION_KINDS.CLOSE, () => ({})),
	defineReactionMapping(ReactionCollectorSkipMissionShopItemReaction, SHOP_REACTION_KINDS.SKIP_MISSION_ENTRY, reaction => ({
		missionIndex: reaction.missionIndex,
		mission: missionData(reaction.mission)
	})),
	defineReactionMapping(ReactionCollectorSkipMissionShopItemCloseReaction, SHOP_REACTION_KINDS.CLOSE, () => ({})),
	defineReactionMapping(ReactionCollectorBuyCategorySlotReaction, SHOP_REACTION_KINDS.BUY_SLOT_CATEGORY, reaction => ({
		categoryId: reaction.categoryId,
		maxSlots: reaction.maxSlots,
		remaining: reaction.remaining
	})),
	defineReactionMapping(ReactionCollectorBuyCategorySlotCancelReaction, SHOP_REACTION_KINDS.CLOSE, () => ({}))
];

export const shopDataMappings: DataMapping[] = [
	defineDataMapping(ReactionCollectorShopData, SHOP_DATA_KINDS.COLLECTOR, data => ({
		availableCurrency: data.availableCurrency,
		currency: data.currency,
		...data.shopId === undefined ? {} : { shopId: data.shopId },
		...data.additionalShopData === undefined
			? {}
			: {
				additionalShopData: {
					...data.additionalShopData.remainingPotions === undefined ? {} : { remainingPotions: data.additionalShopData.remainingPotions },
					...data.additionalShopData.dailyPotion === undefined ? {} : { dailyPotion: data.additionalShopData.dailyPotion },
					...data.additionalShopData.gemToMoneyRatio === undefined ? {} : { gemToMoneyRatio: data.additionalShopData.gemToMoneyRatio },
					...data.additionalShopData.remainingTokens === undefined ? {} : { remainingTokens: data.additionalShopData.remainingTokens },
					...data.additionalShopData.weeklyPlants === undefined ? {} : { weeklyPlants: [...data.additionalShopData.weeklyPlants] },
					...data.additionalShopData.thousandPoints === undefined ? {} : { thousandPoints: data.additionalShopData.thousandPoints }
				}
			}
	})),
	defineDataMapping(ReactionCollectorSkipMissionShopItemData, SHOP_DATA_KINDS.SKIP_MISSION, () => ({})),
	defineDataMapping(ReactionCollectorBuyCategorySlotData, SHOP_DATA_KINDS.BUY_SLOT, () => ({}))
];
