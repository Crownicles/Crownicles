import { ReactionCollectorGuildCreateData } from "../../../../../../Lib/src/packets/interaction/ReactionCollectorGuildCreate";
import { GUILD_DATA_KINDS } from "../../../../../../WsPackets/src/fromServer/collectors";
import {
	DataMapping, defineDataMapping
} from "../CollectorMapping";

export const guildDataMappings: DataMapping[] = [
	defineDataMapping(ReactionCollectorGuildCreateData, GUILD_DATA_KINDS.CREATE, data => ({
		guildName: data.guildName, price: data.price
	}))
];
