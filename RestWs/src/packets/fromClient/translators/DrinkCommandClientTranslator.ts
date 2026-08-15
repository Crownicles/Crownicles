import { fromClientTranslator } from "../FromClientTranslator";
import {
	asyncMakePacket, PacketContext
} from "../../../../../Lib/src/packets/CrowniclesPacket";
import { CommandDrinkPacketReq } from "../../../../../Lib/src/packets/commands/CommandDrinkPacket";
import { DrinkReq } from "../../../../../WsPackets/src/fromClient/DrinkReq";

export default class DrinkCommandClientTranslator {
	@fromClientTranslator(DrinkReq)
	public static translate(_context: PacketContext, _packet: DrinkReq): Promise<CommandDrinkPacketReq> {
		return asyncMakePacket(CommandDrinkPacketReq, {});
	}
}
