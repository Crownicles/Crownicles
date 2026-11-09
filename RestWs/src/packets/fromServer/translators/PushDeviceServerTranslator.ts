import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { CommandPushDeviceRes } from "../../../../../Lib/src/packets/commands/CommandPushDevicePacket";
import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";
import { PushDeviceRegisteredRes } from "../../../../../WsPackets/src/fromServer/settings/PushDeviceRegisteredRes";
import { fromServerTranslator } from "../FromServerTranslator";

export default class PushDeviceServerTranslator {
	@fromServerTranslator(CommandPushDeviceRes, PushDeviceRegisteredRes)
	public static registered(_context: PacketContext, _packet: CommandPushDeviceRes): Promise<PushDeviceRegisteredRes> {
		return asyncMakeFromServerPacket(PushDeviceRegisteredRes, {});
	}
}
