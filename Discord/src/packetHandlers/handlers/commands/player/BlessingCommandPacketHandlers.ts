import { packetHandler } from "../../../PacketHandler";
import {
	PacketContext
} from "../../../../../../Lib/src/packets/CrowniclesPacket";
import { CommandBlessingPacketRes } from "../../../../../../Lib/src/packets/commands/CommandBlessingPacketRes";
import { handleCommandBlessingPacketRes } from "../../../../commands/player/BlessingCommand";

export default class BlessingCommandPacketHandlers {
	@packetHandler(CommandBlessingPacketRes)
	async blessingRes(context: PacketContext, packet: CommandBlessingPacketRes): Promise<void> {
		await handleCommandBlessingPacketRes(context, packet);
	}
}
