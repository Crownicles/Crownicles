import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandDailyBonusCancelPacket, CommandDailyBonusInCooldown, CommandDailyBonusNoAvailableObject, CommandDailyBonusPacketRes
} from "../../../../../Lib/src/packets/commands/CommandDailyBonusPacket";
import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";
import {
	DailyBonusCancelRes, DailyBonusCooldownRes, DailyBonusNoObjectRes, DailyBonusRes
} from "../../../../../WsPackets/src/fromServer/inventory/DailyBonusRes";
import { fromServerTranslator } from "../FromServerTranslator";

export default class DailyBonusCommandServerTranslator {
	@fromServerTranslator(CommandDailyBonusPacketRes, DailyBonusRes)
	public static success(_context: PacketContext, packet: CommandDailyBonusPacketRes): Promise<DailyBonusRes> {
		return asyncMakeFromServerPacket(DailyBonusRes, {
			value: packet.value,
			itemNature: packet.itemNature
		});
	}

	@fromServerTranslator(CommandDailyBonusInCooldown, DailyBonusCooldownRes)
	public static cooldown(_context: PacketContext, packet: CommandDailyBonusInCooldown): Promise<DailyBonusCooldownRes> {
		return asyncMakeFromServerPacket(DailyBonusCooldownRes, {
			cooldownHours: packet.timeBetweenDailies,
			lastDailyTimestamp: packet.lastDailyTimestamp
		});
	}

	@fromServerTranslator(CommandDailyBonusNoAvailableObject, DailyBonusNoObjectRes)
	public static noObject(_context: PacketContext, _packet: CommandDailyBonusNoAvailableObject): Promise<DailyBonusNoObjectRes> {
		return asyncMakeFromServerPacket(DailyBonusNoObjectRes, {});
	}

	@fromServerTranslator(CommandDailyBonusCancelPacket, DailyBonusCancelRes)
	public static cancel(_context: PacketContext, _packet: CommandDailyBonusCancelPacket): Promise<DailyBonusCancelRes> {
		return asyncMakeFromServerPacket(DailyBonusCancelRes, {});
	}
}
