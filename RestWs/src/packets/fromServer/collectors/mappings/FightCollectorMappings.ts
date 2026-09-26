import { ReactionCollectorFightData } from "../../../../../../Lib/src/packets/interaction/ReactionCollectorFight";
import {
	ReactionCollectorFightChooseActionData, ReactionCollectorFightChooseActionReaction
} from "../../../../../../Lib/src/packets/interaction/ReactionCollectorFightChooseAction";
import {
	FIGHT_DATA_KINDS, FIGHT_REACTION_KINDS
} from "../../../../../../WsPackets/src/fromServer/collectors";
import {
	DataMapping, ReactionMapping, defineDataMapping, defineReactionMapping
} from "../CollectorMapping";

export const fightDataMappings: DataMapping[] = [
	defineDataMapping(ReactionCollectorFightData, FIGHT_DATA_KINDS.CONFIRM, data => ({ playerStats: data.playerStats })),
	defineDataMapping(ReactionCollectorFightChooseActionData, FIGHT_DATA_KINDS.ACTION, data => ({ fightId: data.fightId }))
];
export const fightReactionMappings: ReactionMapping[] = [defineReactionMapping(ReactionCollectorFightChooseActionReaction, FIGHT_REACTION_KINDS.ACTION, data => ({ id: data.id }))];
