import { packetHandler } from "../../../PacketHandler";
import { CommandRarityPacketRes } from "../../../../../../Lib/src/packets/commands/CommandRarityPacket";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import { handleCommandRarityPacketRes } from "../../../../commands/player/RarityCommand";

export default class RarityCommandPacketHandlers {
	@packetHandler(CommandRarityPacketRes)
	async rarityRes(context: PacketContext, packet: CommandRarityPacketRes): Promise<void> {
		await handleCommandRarityPacketRes(packet, context);
	}
}
