import { packetHandler } from "../../../PacketHandler";
import {
	CommandGuildLeaveAcceptPacketRes,
	CommandGuildLeaveNotInAGuildPacketRes,
	CommandGuildLeaveRefusePacketRes
} from "../../../../../../Lib/src/packets/commands/CommandGuildLeavePacket";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import { handleClassicError } from "../../../../utils/ErrorUtils";
import {
	handleCommandGuildLeaveAcceptPacketRes,
	handleCommandGuildLeaveRefusePacketRes
} from "../../../../commands/guild/GuildLeaveCommand";

export default class GuildLeaveCommandPacketHandlers {
	@packetHandler(CommandGuildLeaveNotInAGuildPacketRes)
	async guildLeaveNotInAGuildRes(context: PacketContext, _packet: CommandGuildLeaveNotInAGuildPacketRes): Promise<void> {
		await handleClassicError(context, "commands:guildLeave.notInAGuild");
	}

	@packetHandler(CommandGuildLeaveRefusePacketRes)
	async guildLeaveRefuseRes(context: PacketContext, _packet: CommandGuildLeaveRefusePacketRes): Promise<void> {
		await handleCommandGuildLeaveRefusePacketRes(context);
	}

	@packetHandler(CommandGuildLeaveAcceptPacketRes)
	async guildLeaveAcceptRes(context: PacketContext, packet: CommandGuildLeaveAcceptPacketRes): Promise<void> {
		await handleCommandGuildLeaveAcceptPacketRes(packet, context);
	}
}
