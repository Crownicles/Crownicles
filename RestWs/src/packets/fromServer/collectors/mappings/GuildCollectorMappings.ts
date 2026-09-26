import { ReactionCollectorGuildCreateData } from "../../../../../../Lib/src/packets/interaction/ReactionCollectorGuildCreate";
import { ReactionCollectorGuildDescriptionData } from "../../../../../../Lib/src/packets/interaction/ReactionCollectorGuildDescription";
import { ReactionCollectorGuildLeaveData } from "../../../../../../Lib/src/packets/interaction/ReactionCollectorGuildLeave";
import { GUILD_DATA_KINDS } from "../../../../../../WsPackets/src/fromServer/collectors";
import { ReactionCollectorGuildKickData } from "../../../../../../Lib/src/packets/interaction/ReactionCollectorGuildKick";
import { ReactionCollectorGuildElderData } from "../../../../../../Lib/src/packets/interaction/ReactionCollectorGuildElder";
import { ReactionCollectorGuildElderRemoveData } from "../../../../../../Lib/src/packets/interaction/ReactionCollectorGuildElderRemove";
import { ReactionCollectorGuildInviteData } from "../../../../../../Lib/src/packets/interaction/ReactionCollectorGuildInvite";
import { ReactionCollectorGuildReimburseData } from "../../../../../../Lib/src/packets/interaction/ReactionCollectorGuildReimburse";
import {
	DataMapping, defineDataMapping
} from "../CollectorMapping";

export const guildDataMappings: DataMapping[] = [
	defineDataMapping(ReactionCollectorGuildReimburseData, GUILD_DATA_KINDS.REIMBURSE, data => ({ amount: data.amount })),
	defineDataMapping(ReactionCollectorGuildInviteData, GUILD_DATA_KINDS.INVITE, data => ({ guildName: data.guildName })),
	defineDataMapping(ReactionCollectorGuildKickData, GUILD_DATA_KINDS.MEMBER, data => ({
		action: "kick", guildName: data.guildName
	})),
	defineDataMapping(ReactionCollectorGuildElderData, GUILD_DATA_KINDS.MEMBER, data => ({
		action: "promote", guildName: data.guildName
	})),
	defineDataMapping(ReactionCollectorGuildElderRemoveData, GUILD_DATA_KINDS.MEMBER, data => ({
		action: "demote", guildName: data.guildName
	})),
	defineDataMapping(ReactionCollectorGuildDescriptionData, GUILD_DATA_KINDS.DESCRIPTION, data => ({ description: data.description })),
	defineDataMapping(ReactionCollectorGuildLeaveData, GUILD_DATA_KINDS.LEAVE, data => ({
		guildName: data.guildName, isGuildDestroyed: data.isGuildDestroyed
	})),
	defineDataMapping(ReactionCollectorGuildCreateData, GUILD_DATA_KINDS.CREATE, data => ({
		guildName: data.guildName, price: data.price
	}))
];
