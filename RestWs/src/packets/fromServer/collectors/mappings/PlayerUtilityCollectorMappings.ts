import { ReactionCollectorUnlockData } from "../../../../../../Lib/src/packets/interaction/ReactionCollectorUnlock";
import { ReactionCollectorJoinBoatData } from "../../../../../../Lib/src/packets/interaction/ReactionCollectorJoinBoat";
import { PLAYER_UTILITY_DATA_KINDS } from "../../../../../../WsPackets/src/fromServer/collectors";
import {
	DataMapping, defineDataMapping
} from "../CollectorMapping";

export const playerUtilityDataMappings: DataMapping[] = [
	defineDataMapping(ReactionCollectorUnlockData, PLAYER_UTILITY_DATA_KINDS.UNLOCK, data => ({ price: data.price })),
	defineDataMapping(ReactionCollectorJoinBoatData, PLAYER_UTILITY_DATA_KINDS.BOAT, data => ({
		price: data.price, energy: data.energy
	}))
];
