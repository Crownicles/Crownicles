import {BlockedPacket} from "../../../../../Lib/src/packets/commands/BlockedPacket";
import {PacketContext} from "../../../../../Lib/src/packets/CrowniclesPacket";
import {Blocked} from "../../../../../WsPackets/src/fromServer/common/Blocked";
import {asyncMakeFromServerPacket} from "../../../../../WsPackets/src/MakePackets";
import {fromServerTranslator} from "../FromServerTranslator";

export default class BlockedServerTranslator {
	@fromServerTranslator(BlockedPacket, Blocked)
	public static translate(_context: PacketContext, packet: BlockedPacket): Promise<Blocked> {
		return asyncMakeFromServerPacket(Blocked, {reasons: [...packet.reasons]});
	}
}
