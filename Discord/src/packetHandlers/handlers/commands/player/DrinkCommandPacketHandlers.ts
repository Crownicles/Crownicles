import { packetHandler } from "../../../PacketHandler";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import { handleClassicError } from "../../../../utils/ErrorUtils";
import {
	CommandDrinkCancelDrink, CommandDrinkNoAvailablePotion,
	CommandDrinkPacketRes
} from "../../../../../../Lib/src/packets/commands/CommandDrinkPacket";
import { handleDrinkConsumePotion } from "../../../../commands/player/DrinkCommand";

export default class DrinkCommandPacketHandlers {
	@packetHandler(CommandDrinkCancelDrink)
	async drinkCancelDrink(context: PacketContext, _packet: CommandDrinkCancelDrink): Promise<void> {
		await handleClassicError(context, "commands:drink.errors.cancel");
	}

	@packetHandler(CommandDrinkPacketRes)
	async dailyBonusRes(context: PacketContext, packet: CommandDrinkPacketRes): Promise<void> {
		await handleDrinkConsumePotion(context, packet);
	}

	@packetHandler(CommandDrinkNoAvailablePotion)
	async dailyBonusObjectDoNothing(context: PacketContext, _packet: CommandDrinkNoAvailablePotion): Promise<void> {
		await handleClassicError(context, "commands:drink.errors.noAvailablePotion");
	}
}
