import { fromServerTranslator } from "../FromServerTranslator";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { CommandReportEnchanterDisenchantRes } from "../../../../../Lib/src/packets/commands/CommandReportPacket";
import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";
import { EnchanterDisenchantRes } from "../../../../../WsPackets/src/fromServer/report/EnchanterDisenchantRes";

export default class EnchanterServerTranslator {
	@fromServerTranslator(CommandReportEnchanterDisenchantRes, EnchanterDisenchantRes)
	public static disenchant(_context: PacketContext, packet: CommandReportEnchanterDisenchantRes): Promise<EnchanterDisenchantRes> {
		return asyncMakeFromServerPacket(EnchanterDisenchantRes, {
			enchantmentId: packet.enchantmentId, enchantmentType: packet.enchantmentType
		});
	}
}
