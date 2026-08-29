import {
	ReactionCollectorChooseDestinationData,
	ReactionCollectorChooseDestinationReaction,
	ReactionCollectorStayInCityReaction
} from "../../../../../../Lib/src/packets/interaction/ReactionCollectorChooseDestination";
import { ReactionCollectorUseTokensData } from "../../../../../../Lib/src/packets/interaction/ReactionCollectorUseTokens";
import {
	ReactionCollectorTokenMerchantBuyReaction, ReactionCollectorTokenMerchantData
} from "../../../../../../Lib/src/packets/interaction/ReactionCollectorTokenMerchant";
import { ShopConstants } from "../../../../../../Lib/src/constants/ShopConstants";
import { TokensConstants } from "../../../../../../Lib/src/constants/TokensConstants";
import {
	REPORT_COLLECTOR_DATA_KINDS, REPORT_COLLECTOR_REACTION_KINDS
} from "../../../../../../WsPackets/src/fromServer/collectors";
import {
	DataMapping, defineDataMapping, defineReactionMapping, ReactionMapping
} from "../CollectorMapping";

export const reportCollectorReactionMappings: ReactionMapping[] = [
	defineReactionMapping(ReactionCollectorChooseDestinationReaction, REPORT_COLLECTOR_REACTION_KINDS.DESTINATION, reaction => ({
		mapId: reaction.mapId,
		mapTypeId: reaction.mapTypeId,
		...reaction.tripDuration === undefined ? {} : { tripDuration: reaction.tripDuration }
	})),
	defineReactionMapping(ReactionCollectorStayInCityReaction, REPORT_COLLECTOR_REACTION_KINDS.STAY_IN_CITY, () => ({})),
	defineReactionMapping(ReactionCollectorTokenMerchantBuyReaction, REPORT_COLLECTOR_REACTION_KINDS.TOKEN_MERCHANT_BUY, reaction => ({
		amount: reaction.amount
	}))
];

export const reportCollectorDataMappings: DataMapping[] = [
	defineDataMapping(
		ReactionCollectorChooseDestinationData, REPORT_COLLECTOR_DATA_KINDS.DESTINATION, () => ({})
	),
	defineDataMapping(ReactionCollectorUseTokensData, REPORT_COLLECTOR_DATA_KINDS.USE_TOKENS, data => ({
		cost: data.cost,
		playerTokens: data.playerTokens
	})),
	defineDataMapping(ReactionCollectorTokenMerchantData, REPORT_COLLECTOR_DATA_KINDS.TOKEN_MERCHANT, data => ({
		pricePerToken: data.pricePerToken,
		playerMoney: data.playerMoney,
		playerTokens: data.playerTokens,
		maxTokens: TokensConstants.MAX,
		maxDaily: ShopConstants.MAX_DAILY_TOKEN_BUYOUTS,
		maxWeekly: ShopConstants.MAX_WEEKLY_TOKEN_BUYOUTS,
		amounts: data.amounts
	}))
];
