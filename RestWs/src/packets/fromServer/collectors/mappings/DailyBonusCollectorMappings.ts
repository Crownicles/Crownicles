import {
	ReactionCollectorDailyBonusData, ReactionCollectorDailyBonusReaction
} from "../../../../../../Lib/src/packets/interaction/ReactionCollectorDailyBonus";
import {
	DAILY_BONUS_DATA_KINDS, DAILY_BONUS_REACTION_KINDS
} from "../../../../../../WsPackets/src/fromServer/collectors";
import {
	DataMapping, defineDataMapping, defineReactionMapping, ReactionMapping
} from "../CollectorMapping";

export const dailyBonusDataMappings: DataMapping[] = [defineDataMapping(ReactionCollectorDailyBonusData, DAILY_BONUS_DATA_KINDS.COLLECTOR, () => ({}))];

export const dailyBonusReactionMappings: ReactionMapping[] = [defineReactionMapping(ReactionCollectorDailyBonusReaction, DAILY_BONUS_REACTION_KINDS.OBJECT, reaction => ({ object: reaction.object }))];
