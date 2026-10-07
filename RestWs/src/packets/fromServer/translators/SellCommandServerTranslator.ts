import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandSellCancelErrorPacket, CommandSellItemSuccessPacket, CommandSellNoItemErrorPacket
} from "../../../../../Lib/src/packets/commands/CommandSellPacket";
import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";
import {
	SellCancelRes, SellNoItemRes, SellRes
} from "../../../../../WsPackets/src/fromServer/inventory/SellRes";
import { fromServerTranslator } from "../FromServerTranslator";

export default class SellCommandServerTranslator {
	@fromServerTranslator(CommandSellItemSuccessPacket, SellRes)
	public static success(_context: PacketContext, packet: CommandSellItemSuccessPacket): Promise<SellRes> {
		return asyncMakeFromServerPacket(SellRes, {
			item: packet.item,
			price: packet.price
		});
	}

	@fromServerTranslator(CommandSellNoItemErrorPacket, SellNoItemRes)
	public static noItem(_context: PacketContext, _packet: CommandSellNoItemErrorPacket): Promise<SellNoItemRes> {
		return asyncMakeFromServerPacket(SellNoItemRes, {});
	}

	@fromServerTranslator(CommandSellCancelErrorPacket, SellCancelRes)
	public static cancel(_context: PacketContext, _packet: CommandSellCancelErrorPacket): Promise<SellCancelRes> {
		return asyncMakeFromServerPacket(SellCancelRes, {});
	}
}
