import { packetHandler } from "../../../PacketHandler";
import {
	CommandDailyBonusCancelPacket,
	CommandDailyBonusInCooldown,
	CommandDailyBonusNoAvailableObject,
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

	@packetHandler(CommandDailyBonusNoAvailableObject)
	async dailyBonusObjectDoNothing(context: PacketContext, _packet: CommandDailyBonusNoAvailableObject): Promise<void> {
		await handleClassicError(context, "commands:daily.errors.noAvailableObject");
	}

	@packetHandler(CommandDailyBonusCancelPacket)
	async dailyBonusObjectIsActiveDuringFights(context: PacketContext, _packet: CommandDailyBonusCancelPacket): Promise<void> {
		await handleClassicError(context, "commands:daily.errors.cancel");
	}

	@packetHandler(CommandDailyBonusInCooldown)
	async dailyBonusInCooldown(context: PacketContext, packet: CommandDailyBonusInCooldown): Promise<void> {
		await handleDailyBonusCooldownError(context, packet.lastDailyTimestamp, packet.timeBetweenDailies);
	}
}
