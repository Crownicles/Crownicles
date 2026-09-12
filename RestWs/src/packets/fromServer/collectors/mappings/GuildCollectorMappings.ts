import { ReactionCollectorGuildCreateData } from "../../../../../../Lib/src/packets/interaction/ReactionCollectorGuildCreate";
import { ReactionCollectorGuildDescriptionData } from "../../../../../../Lib/src/packets/interaction/ReactionCollectorGuildDescription";
import { ReactionCollectorGuildLeaveData } from "../../../../../../Lib/src/packets/interaction/ReactionCollectorGuildLeave";
import { GUILD_DATA_KINDS } from "../../../../../../WsPackets/src/fromServer/collectors";
import {
	DataMapping, defineDataMapping
} from "../CollectorMapping";

export const guildDataMappings: DataMapping[] = [
	defineDataMapping(ReactionCollectorGuildDescriptionData, GUILD_DATA_KINDS.DESCRIPTION, data => ({ description: data.description })),
	defineDataMapping(ReactionCollectorGuildLeaveData, GUILD_DATA_KINDS.LEAVE, data => ({
		guildName: data.guildName, isGuildDestroyed: data.isGuildDestroyed
	})),
	defineDataMapping(ReactionCollectorGuildCreateData, GUILD_DATA_KINDS.CREATE, data => ({
		guildName: data.guildName, price: data.price
	}))
];
