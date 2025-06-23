import { packetHandler } from "../../../PacketHandler";
import {
	CommandGuildElderAcceptPacketRes,
	CommandGuildElderAlreadyElderPacketRes, CommandGuildElderFoundPlayerPacketRes,
	CommandGuildElderHimselfPacketRes, CommandGuildElderRefusePacketRes,
	CommandGuildElderSameGuildPacketRes
} from "../../../../../../Lib/src/packets/commands/CommandGuildElderPacket";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import { handleClassicError } from "../../../../utils/ErrorUtils";
import {
	handleCommandGuildElderAcceptPacketRes,
	handleCommandGuildElderRefusePacketRes
} from "../../../../commands/guild/GuildElderCommand";

export default class GuildElderCommandPacketHandlers {
	@packetHandler(CommandGuildElderSameGuildPacketRes)
	async guildElderSameGuildRes(context: PacketContext, _packet: CommandGuildElderSameGuildPacketRes): Promise<void> {
		await handleClassicError(context, "commands:guildElder.notSameGuild");
	}

	@packetHandler(CommandGuildElderHimselfPacketRes)
	async guildElderHimselfRes(context: PacketContext, _packet: CommandGuildElderHimselfPacketRes): Promise<void> {
		await handleClassicError(context, "commands:guildElder.chiefError");
	}

	@packetHandler(CommandGuildElderAlreadyElderPacketRes)
	async guildElderAlreadyElderRes(context: PacketContext, _packet: CommandGuildElderAlreadyElderPacketRes): Promise<void> {
		await handleClassicError(context, "commands:guildElder.alreadyElder");
	}

	@packetHandler(CommandGuildElderFoundPlayerPacketRes)
	async guildElderFoundPlayerRes(context: PacketContext, _packet: CommandGuildElderFoundPlayerPacketRes): Promise<void> {
		await handleClassicError(context, "commands:guildElder.playerNotFound");
	}

	@packetHandler(CommandGuildElderRefusePacketRes)
	async guildElderRefuseRes(context: PacketContext, packet: CommandGuildElderRefusePacketRes): Promise<void> {
		await handleCommandGuildElderRefusePacketRes(packet, context);
	}

	@packetHandler(CommandGuildElderAcceptPacketRes)
	async guildElderAcceptRes(context: PacketContext, packet: CommandGuildElderAcceptPacketRes): Promise<void> {
		await handleCommandGuildElderAcceptPacketRes(packet, context);
	}
}
