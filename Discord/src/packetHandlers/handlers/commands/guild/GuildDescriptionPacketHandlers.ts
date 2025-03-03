import {packetHandler} from "../../../PacketHandler";
import {
	CommandGuildDescriptionAcceptPacketRes,
	CommandGuildDescriptionNoGuildPacket,
	CommandGuildDescriptionNotAnElderPacket, CommandGuildDescriptionRefusePacketRes
} from "../../../../../../Lib/src/packets/commands/CommandGuildDescriptionPacket";
import {PacketContext} from "../../../../../../Lib/src/packets/DraftBotPacket";
import {CommandGuildElderRemoveNoElderPacket} from "../../../../../../Lib/src/packets/commands/CommandGuildElderRemovePacket";
import {handleClassicError} from "../../../../utils/ErrorUtils";
import {
	handleCommandGuildDescriptionAcceptPacketRes,
	handleCommandGuildDescriptionRefusePacketRes
} from "../../../../commands/guild/GuildDescriptionCommand";

export default class GuildDescriptionCommandPacketHandlers {
	@packetHandler(CommandGuildDescriptionNoGuildPacket)
	async guildDescriptionNoGuildRes(context: PacketContext, _packet: CommandGuildElderRemoveNoElderPacket): Promise<void> {
		await handleClassicError(context, "commands:guildDescription.noGuild");
	}

	@packetHandler(CommandGuildDescriptionNotAnElderPacket)
	async guildDescriptionNotAnElderRes(context: PacketContext, _packet: CommandGuildDescriptionNotAnElderPacket): Promise<void> {
		await handleClassicError(context, "commands:guildDescription.notAnElder");
	}

	@packetHandler(CommandGuildDescriptionRefusePacketRes)
	async guildDescriptionRefuseRes(context: PacketContext, packet: CommandGuildDescriptionRefusePacketRes): Promise<void> {
		await handleCommandGuildDescriptionRefusePacketRes(packet, context);
	}

	@packetHandler(CommandGuildDescriptionAcceptPacketRes)
	async guildDescriptionAcceptRes(context: PacketContext, packet: CommandGuildDescriptionAcceptPacketRes): Promise<void> {
		await handleCommandGuildDescriptionAcceptPacketRes(packet, context);
	}
}