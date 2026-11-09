import { fromServerTranslator } from "../FromServerTranslator";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { CommandReportBlacksmithEnchantmentTransferRes } from "../../../../../Lib/src/packets/commands/CommandReportPacket";
import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";
import { BlacksmithEnchantmentTransferRes } from "../../../../../WsPackets/src/fromServer/report/BlacksmithEnchantmentTransferRes";

export default class BlacksmithServerTranslator {
	@fromServerTranslator(CommandReportBlacksmithEnchantmentTransferRes, BlacksmithEnchantmentTransferRes)
	public static enchantmentTransfer(_context: PacketContext, packet: CommandReportBlacksmithEnchantmentTransferRes): Promise<BlacksmithEnchantmentTransferRes> {
		return asyncMakeFromServerPacket(BlacksmithEnchantmentTransferRes, {
			enchantmentId: packet.enchantmentId, enchantmentType: packet.enchantmentType, cost: packet.cost
		});
	}
}
