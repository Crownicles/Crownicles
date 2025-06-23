import { packetHandler } from "../../../PacketHandler";
import {
	CommandGuildElderRemoveAcceptPacketRes,
	CommandGuildElderRemoveNoElderPacket,
	CommandGuildElderRemoveRefusePacketRes
} from "../../../../../../Lib/src/packets/commands/CommandGuildElderRemovePacket";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import { handleClassicError } from "../../../../utils/ErrorUtils";
import {
	handleCommandGuildElderRemoveAcceptPacketRes,
	handleCommandGuildElderRemoveRefusePacketRes
} from "../../../../commands/guild/GuildElderRemoveCommand";

export default class GuildElderRemoveCommandPacketHandlers {
	@packetHandler(CommandGuildElderRemoveNoElderPacket)
	async guildElderRemoveFoundPlayerRes(context: PacketContext, _packet: CommandGuildElderRemoveNoElderPacket): Promise<void> {
		await handleClassicError(context, "commands:guildElderRemove.noElder");
	}

	@packetHandler(CommandGuildElderRemoveRefusePacketRes)
	async guildElderRemoveRefuseRes(context: PacketContext, packet: CommandGuildElderRemoveRefusePacketRes): Promise<void> {
		await handleCommandGuildElderRemoveRefusePacketRes(packet, context);
	}

	@packetHandler(CommandGuildElderRemoveAcceptPacketRes)
	async guildElderRemoveAcceptRes(context: PacketContext, packet: CommandGuildElderRemoveAcceptPacketRes): Promise<void> {
		await handleCommandGuildElderRemoveAcceptPacketRes(packet, context);
	}
}
