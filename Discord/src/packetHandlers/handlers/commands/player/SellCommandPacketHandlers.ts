import { packetHandler } from "../../../PacketHandler";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import { handleClassicError } from "../../../../utils/ErrorUtils";
import {
	CommandSellCancelErrorPacket, CommandSellItemSuccessPacket,
	CommandSellNoItemErrorPacket
} from "../../../../../../Lib/src/packets/commands/CommandSellPacket";
import { handleCommandSellSuccessPacket } from "../../../../commands/player/SellCommand";

export default class SellCommandPacketHandlers {
	@packetHandler(CommandSellNoItemErrorPacket)
	async sellNoItemError(context: PacketContext, _packet: CommandSellNoItemErrorPacket): Promise<void> {
		await handleClassicError(context, "commands:sell.noItemToSell");
	}

	@packetHandler(CommandSellCancelErrorPacket)
	async sellCancelError(context: PacketContext, _packet: CommandSellCancelErrorPacket): Promise<void> {
		await handleClassicError(context, "commands:sell.sellCanceled");
	}

	@packetHandler(CommandSellItemSuccessPacket)
	async sellSuccess(context: PacketContext, packet: CommandSellItemSuccessPacket): Promise<void> {
		await handleCommandSellSuccessPacket(packet, context);
	}
}
