import {
	ReactionCollectorEquipCloseReaction, ReactionCollectorEquipData
} from "../../../../../../Lib/src/packets/interaction/ReactionCollectorEquip";
import {
	EQUIP_DATA_KINDS, EQUIP_REACTION_KINDS
} from "../../../../../../WsPackets/src/fromServer/collectors";
import {
	DataMapping, defineDataMapping, defineReactionMapping, ReactionMapping
} from "../CollectorMapping";

export const equipDataMappings: DataMapping[] = [defineDataMapping(ReactionCollectorEquipData, EQUIP_DATA_KINDS.COLLECTOR, data => ({ categories: data.categories }))];

export const equipReactionMappings: ReactionMapping[] = [defineReactionMapping(ReactionCollectorEquipCloseReaction, EQUIP_REACTION_KINDS.CLOSE, () => ({}))];
