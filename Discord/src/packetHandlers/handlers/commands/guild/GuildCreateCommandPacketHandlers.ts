import { packetHandler } from "../../../PacketHandler";
import {
	CommandGuildCreateAcceptPacketRes,
	CommandGuildCreatePacketRes,
	CommandGuildCreateRefusePacketRes
} from "../../../../../../Lib/src/packets/commands/CommandGuildCreatePacket";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import {
	handleCommandGuildCreateAcceptPacketRes,
	handleCommandGuildCreatePacketRes,
	handleCommandGuildCreateRefusePacketRes
} from "../../../../commands/guild/GuildCreateCommand";

export default class GuildCreateCommandPacketHandlers {
	@packetHandler(CommandGuildCreatePacketRes)
	async guildCreateRes(context: PacketContext, packet: CommandGuildCreatePacketRes): Promise<void> {
		await handleCommandGuildCreatePacketRes(packet, context);
	}

	@packetHandler(CommandGuildCreateRefusePacketRes)
	async guildCreateRefuseRes(context: PacketContext, _packet: CommandGuildCreateRefusePacketRes): Promise<void> {
		await handleCommandGuildCreateRefusePacketRes(context);
	}

	@packetHandler(CommandGuildCreateAcceptPacketRes)
	async guildCreateAcceptRes(context: PacketContext, packet: CommandGuildCreateAcceptPacketRes): Promise<void> {
		await handleCommandGuildCreateAcceptPacketRes(packet, context);
	}
}
