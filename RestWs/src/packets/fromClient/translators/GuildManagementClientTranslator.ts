import { fromClientTranslator } from "../FromClientTranslator";
import { InvalidClientPacketError } from "../InvalidClientPacketError";
import {
	asyncMakePacket, PacketContext
} from "../../../../../Lib/src/packets/CrowniclesPacket";
import { CommandGuildDescriptionPacketReq } from "../../../../../Lib/src/packets/commands/CommandGuildDescriptionPacket";
import { CommandGuildLeavePacketReq } from "../../../../../Lib/src/packets/commands/CommandGuildLeavePacket";
import {
	GuildDescriptionReq, GuildLeaveReq
} from "../../../../../WsPackets/src/fromClient/GuildManagementReq";

export default class GuildManagementClientTranslator {
	@fromClientTranslator(GuildDescriptionReq)
	public static description(_context: PacketContext, packet: GuildDescriptionReq): Promise<CommandGuildDescriptionPacketReq> {
		if (typeof packet.description !== "string") {
			throw new InvalidClientPacketError("Invalid guild description");
		}
		return asyncMakePacket(CommandGuildDescriptionPacketReq, { description: packet.description });
	}

	@fromClientTranslator(GuildLeaveReq)
	public static leave(_context: PacketContext, _packet: GuildLeaveReq): Promise<CommandGuildLeavePacketReq> {
		return asyncMakePacket(CommandGuildLeavePacketReq, {});
	}
}
