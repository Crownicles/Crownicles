import { packetHandler } from "../../../PacketHandler";
import {
	CommandDrinkCancelDrink,
	CommandDrinkConsumePotionRes,
	CommandDrinkNoActiveObjectError,
	CommandDrinkObjectIsActiveDuringFights
} from "../../../../../../Lib/src/packets/commands/CommandDrinkPacket";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import {
	handleDrinkCancellation, handleDrinkConsumePotion
} from "../../../../commands/player/DrinkCommand";
import { handleClassicError } from "../../../../utils/ErrorUtils";

export default class DrinkCommandPacketHandlers {
	@packetHandler(CommandDrinkConsumePotionRes)
	async drinkConsumePotionRes(context: PacketContext, packet: CommandDrinkConsumePotionRes): Promise<void> {
		await handleDrinkConsumePotion(context, packet);
	}

	@packetHandler(CommandDrinkCancelDrink)
	async drinkCancelDrink(context: PacketContext, _packet: CommandDrinkCancelDrink): Promise<void> {
		await handleDrinkCancellation(context);
	}

	@packetHandler(CommandDrinkNoActiveObjectError)
	async drinkNoActiveObjectError(context: PacketContext, _packet: CommandDrinkNoActiveObjectError): Promise<void> {
		await handleClassicError(context, "commands:drink.noActiveObject");
	}

	@packetHandler(CommandDrinkObjectIsActiveDuringFights)
	async drinkObjectIsActiveDuringFights(context: PacketContext, _packet: CommandDrinkObjectIsActiveDuringFights): Promise<void> {
		await handleClassicError(context, "commands:drink.objectIsActiveDuringFights");
	}
}
