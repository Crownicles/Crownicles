import { packetHandler } from "../../../PacketHandler";
import {
	CommandDailyBonusInCooldown,
	CommandDailyBonusNoActiveObject,
	CommandDailyBonusObjectDoNothing, CommandDailyBonusObjectIsActiveDuringFights,
	CommandDailyBonusPacketRes
} from "../../../../../../Lib/src/packets/commands/CommandDailyBonusPacket";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import {
	handleDailyBonusCooldownError, handleDailyBonusRes
} from "../../../../commands/player/DailyBonusCommand";
import { handleClassicError } from "../../../../utils/ErrorUtils";

export default class DailyBonusCommandPacketHandlers {
	@packetHandler(CommandDailyBonusPacketRes)
	async dailyBonusRes(context: PacketContext, packet: CommandDailyBonusPacketRes): Promise<void> {
		await handleDailyBonusRes(context, packet);
	}

	@packetHandler(CommandDailyBonusObjectDoNothing)
	async dailyBonusObjectDoNothing(context: PacketContext, _packet: CommandDailyBonusObjectDoNothing): Promise<void> {
		await handleClassicError(context, "commands:daily.errors.objectDoNothingError");
	}

	@packetHandler(CommandDailyBonusObjectIsActiveDuringFights)
	async dailyBonusObjectIsActiveDuringFights(context: PacketContext, _packet: CommandDailyBonusObjectIsActiveDuringFights): Promise<void> {
		await handleClassicError(context, "commands:daily.errors.objectIsActiveDuringFights");
	}

	@packetHandler(CommandDailyBonusNoActiveObject)
	async dailyBonusNoActiveObject(context: PacketContext, _packet: CommandDailyBonusNoActiveObject): Promise<void> {
		await handleClassicError(context, "commands:daily.errors.noActiveObject");
	}

	@packetHandler(CommandDailyBonusInCooldown)
	async dailyBonusInCooldown(context: PacketContext, packet: CommandDailyBonusInCooldown): Promise<void> {
		await handleDailyBonusCooldownError(context, packet.lastDailyTimestamp, packet.timeBetweenDailies);
	}
}
