import { packetHandler } from "../../../PacketHandler";
import { CommandGuildPacketRes } from "../../../../../../Lib/src/packets/commands/CommandGuildPacket";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import { handleCommandGuildPacketRes } from "../../../../commands/guild/GuildCommand";

export default class GuildCommandPacketHandlers {
	@packetHandler(CommandGuildPacketRes)
	async guildRes(context: PacketContext, packet: CommandGuildPacketRes): Promise<void> {
		await handleCommandGuildPacketRes(packet, context);
	}
}
