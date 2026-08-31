import {
	ReactionCollectorShopCloseReaction,
	ReactionCollectorShopData,
	ReactionCollectorShopItemReaction
} from "../../../../../../Lib/src/packets/interaction/ReactionCollectorShop";
import {SHOP_DATA_KINDS, SHOP_REACTION_KINDS} from "../../../../../../WsPackets/src/fromServer/collectors";
import {DataMapping, defineDataMapping, defineReactionMapping, ReactionMapping} from "../CollectorMapping";

export const shopReactionMappings: ReactionMapping[] = [
	defineReactionMapping(ReactionCollectorShopItemReaction, SHOP_REACTION_KINDS.ITEM, reaction => ({
		shopCategoryId: reaction.shopCategoryId,
		shopItemId: reaction.shopItemId,
		price: reaction.price,
		amount: reaction.amount
	})),
	defineReactionMapping(ReactionCollectorShopCloseReaction, SHOP_REACTION_KINDS.CLOSE, () => ({}))
];

export const shopDataMappings: DataMapping[] = [
	defineDataMapping(ReactionCollectorShopData, SHOP_DATA_KINDS.COLLECTOR, data => ({
		availableCurrency: data.availableCurrency,
		currency: data.currency,
		...data.additionalShopData === undefined ? {} : {
			additionalShopData: {
				...data.additionalShopData.remainingPotions === undefined ? {} : {remainingPotions: data.additionalShopData.remainingPotions},
				...data.additionalShopData.dailyPotion === undefined ? {} : {dailyPotion: data.additionalShopData.dailyPotion},
				...data.additionalShopData.gemToMoneyRatio === undefined ? {} : {gemToMoneyRatio: data.additionalShopData.gemToMoneyRatio},
				...data.additionalShopData.remainingTokens === undefined ? {} : {remainingTokens: data.additionalShopData.remainingTokens},
				...data.additionalShopData.weeklyPlants === undefined ? {} : {weeklyPlants: [...data.additionalShopData.weeklyPlants]}
			}
		}
	}))
];
