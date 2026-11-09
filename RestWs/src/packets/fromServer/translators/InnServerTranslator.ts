import { fromServerTranslator } from "../FromServerTranslator";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportBedCooldownRes, CommandReportEatInnMealCooldownRes, CommandReportEatInnMealRes, CommandReportSleepRoomRes
} from "../../../../../Lib/src/packets/commands/CommandReportPacket";
import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";
import {
	INN_OUTCOMES, InnRes
} from "../../../../../WsPackets/src/fromServer/report/InnRes";

export default class InnServerTranslator {
	@fromServerTranslator(CommandReportEatInnMealRes, InnRes)
	public static meal(_context: PacketContext, packet: CommandReportEatInnMealRes): Promise<InnRes> {
		return asyncMakeFromServerPacket(InnRes, { outcome: {
			type: INN_OUTCOMES.MEAL, energy: packet.energy, moneySpent: packet.moneySpent
		} });
	}

	@fromServerTranslator(CommandReportSleepRoomRes, InnRes)
	public static room(_context: PacketContext, packet: CommandReportSleepRoomRes): Promise<InnRes> {
		return asyncMakeFromServerPacket(InnRes, { outcome: {
			type: INN_OUTCOMES.ROOM, roomId: packet.roomId, health: packet.health, moneySpent: packet.moneySpent
		} });
	}

	@fromServerTranslator(CommandReportEatInnMealCooldownRes, InnRes)
	public static mealCooldown(_context: PacketContext, packet: CommandReportEatInnMealCooldownRes): Promise<InnRes> {
		return asyncMakeFromServerPacket(InnRes, { outcome: {
			type: INN_OUTCOMES.MEAL_COOLDOWN, nextAvailableAt: packet.nextAvailableAt
		} });
	}

	@fromServerTranslator(CommandReportBedCooldownRes, InnRes)
	public static bedCooldown(_context: PacketContext, packet: CommandReportBedCooldownRes): Promise<InnRes> {
		return asyncMakeFromServerPacket(InnRes, { outcome: {
			type: INN_OUTCOMES.BED_COOLDOWN, nextAvailableAt: packet.nextAvailableAt
		} });
	}
}
