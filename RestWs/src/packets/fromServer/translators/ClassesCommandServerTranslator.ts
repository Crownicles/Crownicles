import { fromServerTranslator } from "../FromServerTranslator";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandClassesCancelErrorPacket, CommandClassesChangeSuccessPacket, CommandClassesCooldownErrorPacket
} from "../../../../../Lib/src/packets/commands/CommandClassesPacket";
import { CommandClassesInfoPacketRes } from "../../../../../Lib/src/packets/commands/CommandClassesInfoPacket";
import {
	ClassesRes, ClassesCancelRes, ClassesCooldownRes
} from "../../../../../WsPackets/src/fromServer/classes/ClassesRes";
import { ClassesInfoRes } from "../../../../../WsPackets/src/fromServer/classes/ClassesInfoRes";
import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";

export default class ClassesCommandServerTranslator {
	@fromServerTranslator(CommandClassesInfoPacketRes, ClassesInfoRes)
	public static info(_context: PacketContext, packet: CommandClassesInfoPacketRes): Promise<ClassesInfoRes> {
		return asyncMakeFromServerPacket(ClassesInfoRes, { ...packet.data ? { data: packet.data } : {} });
	}

	@fromServerTranslator(CommandClassesChangeSuccessPacket, ClassesRes)
	public static success(_context: PacketContext, packet: CommandClassesChangeSuccessPacket): Promise<ClassesRes> {
		return asyncMakeFromServerPacket(ClassesRes, { classId: packet.classId });
	}

	@fromServerTranslator(CommandClassesCooldownErrorPacket, ClassesCooldownRes)
	public static cooldown(_context: PacketContext, packet: CommandClassesCooldownErrorPacket): Promise<ClassesCooldownRes> {
		return asyncMakeFromServerPacket(ClassesCooldownRes, { timestamp: packet.timestamp });
	}

	@fromServerTranslator(CommandClassesCancelErrorPacket, ClassesCancelRes)
	public static cancel(_context: PacketContext, _packet: CommandClassesCancelErrorPacket): Promise<ClassesCancelRes> {
		return asyncMakeFromServerPacket(ClassesCancelRes, {});
	}
}
