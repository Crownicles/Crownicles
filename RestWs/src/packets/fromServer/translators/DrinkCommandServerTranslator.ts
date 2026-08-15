import { fromServerTranslator } from "../FromServerTranslator";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandDrinkCancelDrink,
	CommandDrinkNoAvailablePotion,
	CommandDrinkPacketRes
} from "../../../../../Lib/src/packets/commands/CommandDrinkPacket";
import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";
import { DrinkRes } from "../../../../../WsPackets/src/fromServer/drink/DrinkRes";
import { DrinkCancel } from "../../../../../WsPackets/src/fromServer/drink/DrinkCancel";
import { DrinkNoAvailablePotion } from "../../../../../WsPackets/src/fromServer/drink/DrinkNoAvailablePotion";

export default class DrinkCommandServerTranslator {
	@fromServerTranslator(CommandDrinkPacketRes, DrinkRes)
	public static translate(_context: PacketContext, packet: CommandDrinkPacketRes): Promise<DrinkRes> {
		return asyncMakeFromServerPacket(DrinkRes, {
			value: packet.value,
			itemNature: packet.itemNature
		});
	}

	@fromServerTranslator(CommandDrinkCancelDrink, DrinkCancel)
	public static translateCancel(_context: PacketContext, _packet: CommandDrinkCancelDrink): Promise<DrinkCancel> {
		return asyncMakeFromServerPacket(DrinkCancel, {});
	}

	@fromServerTranslator(CommandDrinkNoAvailablePotion, DrinkNoAvailablePotion)
	public static translateNoAvailablePotion(_context: PacketContext, _packet: CommandDrinkNoAvailablePotion): Promise<DrinkNoAvailablePotion> {
		return asyncMakeFromServerPacket(DrinkNoAvailablePotion, {});
	}
}
