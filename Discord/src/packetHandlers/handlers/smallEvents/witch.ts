import { packetHandler } from "../../PacketHandler";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { SmallEventWitchResultPacket } from "../../../../../Lib/src/packets/smallEvents/SmallEventWitchPacket";
import { witchResult } from "../../../smallEvents/witch";

export default class WitchSmallEventHandler {
	@packetHandler(SmallEventWitchResultPacket)
	async smallEventWitchResult(context: PacketContext, packet: SmallEventWitchResultPacket): Promise<void> {
		await witchResult(packet, context);
	}
}
