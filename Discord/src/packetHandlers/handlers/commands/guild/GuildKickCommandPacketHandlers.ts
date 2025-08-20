import { packetHandler } from "../../../PacketHandler";
import {
	CommandGuildKickAcceptPacketRes, CommandGuildKickBlockedErrorPacket,
	CommandGuildKickPacketRes,
	CommandGuildKickRefusePacketRes
} from "../../../../../../Lib/src/packets/commands/CommandGuildKickPacket";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import {
	handleCommandGuildKickAcceptPacketRes,
	handleCommandGuildKickPacketRes,
	handleCommandGuildKickRefusePacketRes
} from "../../../../commands/guild/GuildKickCommand";
import { handleClassicError } from "../../../../utils/ErrorUtils";

export default class GuildKickCommandPacketHandlers {
	@packetHandler(CommandGuildKickPacketRes)
	async guildKickRes(context: PacketContext, packet: CommandGuildKickPacketRes): Promise<void> {
		await handleCommandGuildKickPacketRes(packet, context);
	}

	@packetHandler(CommandGuildKickRefusePacketRes)
	async guildKickRefuseRes(context: PacketContext, packet: CommandGuildKickRefusePacketRes): Promise<void> {
		await handleCommandGuildKickRefusePacketRes(packet, context);
	}

	@packetHandler(CommandGuildKickAcceptPacketRes)
	async guildKickAcceptRes(context: PacketContext, packet: CommandGuildKickAcceptPacketRes): Promise<void> {
		await handleCommandGuildKickAcceptPacketRes(packet, context);
	}

	@packetHandler(CommandGuildKickBlockedErrorPacket)
	async guildKickBlockedError(context: PacketContext, _packet: CommandGuildKickBlockedErrorPacket): Promise<void> {
		await handleClassicError(context, "commands:guildKick.blocked");
	}
}
