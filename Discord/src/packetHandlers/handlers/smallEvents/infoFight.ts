import { packetHandler } from "../../PacketHandler";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { SmallEventInfoFightPacket } from "../../../../../Lib/src/packets/smallEvents/SmallEventInfoFightPacket";
import { infoFightResult } from "../../../smallEvents/infoFight";

export default class InfoFightSmallEventHandler {
	@packetHandler(SmallEventInfoFightPacket)
	async smallEventInfoFight(context: PacketContext, packet: SmallEventInfoFightPacket): Promise<void> {
		await infoFightResult(context, packet);
	}
}
