import { packetHandler } from "../../../PacketHandler";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import { CommandGuildStoragePacketRes } from "../../../../../../Lib/src/packets/commands/CommandGuildStoragePacket";
import { handleSuccess } from "../../../../commands/guild/GuildStorageCommand";

export default class GuildStorageCommandPacketHandlers {
	@packetHandler(CommandGuildStoragePacketRes)
	async handleGuildStorageSuccess(context: PacketContext, packet: CommandGuildStoragePacketRes): Promise<void> {
		await handleSuccess(packet, context);
	}
}
