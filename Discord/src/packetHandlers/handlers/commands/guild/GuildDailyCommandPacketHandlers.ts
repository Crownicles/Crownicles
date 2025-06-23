import { packetHandler } from "../../../PacketHandler";
import {
	CommandGuildDailyCooldownErrorPacket,
	CommandGuildDailyPveIslandErrorPacket,
	CommandGuildDailyRewardPacket
} from "../../../../../../Lib/src/packets/commands/CommandGuildDailyPacket";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import { handleCommandGuildDailyRewardPacket } from "../../../../commands/guild/GuildDailyCommand";
import { handleClassicError } from "../../../../utils/ErrorUtils";
import { finishInTimeDisplay } from "../../../../../../Lib/src/utils/TimeUtils";

export default class GuildDailyCommandPacketHandlers {
	@packetHandler(CommandGuildDailyRewardPacket)
	async guildDailyReward(context: PacketContext, packet: CommandGuildDailyRewardPacket): Promise<void> {
		await handleCommandGuildDailyRewardPacket(packet, context, true);
	}

	@packetHandler(CommandGuildDailyCooldownErrorPacket)
	async guildDailyCooldownError(context: PacketContext, packet: CommandGuildDailyCooldownErrorPacket): Promise<void> {
		await handleClassicError(context, "commands:guildDaily.coolDown", {
			coolDownTime: packet.totalTime,
			time: finishInTimeDisplay(new Date(Date.now() + packet.remainingTime))
		});
	}

	@packetHandler(CommandGuildDailyPveIslandErrorPacket)
	async guildDailyPveIslandError(context: PacketContext, _packet: CommandGuildDailyPveIslandErrorPacket): Promise<void> {
		await handleClassicError(context, "commands:guildDaily.pveIslandError");
	}
}
