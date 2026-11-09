import { fromServerTranslator } from "../FromServerTranslator";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandDefenseCancelPacketRes, CommandDefenseChangeSuccessPacketRes, CommandDefenseNoChoicePacketRes
} from "../../../../../Lib/src/packets/commands/CommandDefensePacket";
import {
	DefenseCancelRes, DefenseNoChoiceRes, DefenseRes
} from "../../../../../WsPackets/src/fromServer/defense/DefenseRes";
import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";

export default class DefenseCommandServerTranslator {
	@fromServerTranslator(CommandDefenseChangeSuccessPacketRes, DefenseRes)
	public static success(_context: PacketContext, packet: CommandDefenseChangeSuccessPacketRes): Promise<DefenseRes> {
		return asyncMakeFromServerPacket(DefenseRes, packet.personality ? { personality: packet.personality } : {});
	}

	@fromServerTranslator(CommandDefenseNoChoicePacketRes, DefenseNoChoiceRes)
	public static noChoice(_context: PacketContext, packet: CommandDefenseNoChoicePacketRes): Promise<DefenseNoChoiceRes> {
		return asyncMakeFromServerPacket(DefenseNoChoiceRes, { classId: packet.classId });
	}

	@fromServerTranslator(CommandDefenseCancelPacketRes, DefenseCancelRes)
	public static cancel(_context: PacketContext, _packet: CommandDefenseCancelPacketRes): Promise<DefenseCancelRes> {
		return asyncMakeFromServerPacket(DefenseCancelRes, {});
	}
}
