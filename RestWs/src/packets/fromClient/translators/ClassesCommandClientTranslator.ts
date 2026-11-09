import { fromClientTranslator } from "../FromClientTranslator";
import {
	asyncMakePacket, PacketContext
} from "../../../../../Lib/src/packets/CrowniclesPacket";
import { CommandClassesPacketReq } from "../../../../../Lib/src/packets/commands/CommandClassesPacket";
import { CommandClassesInfoPacketReq } from "../../../../../Lib/src/packets/commands/CommandClassesInfoPacket";
import { ClassesReq } from "../../../../../WsPackets/src/fromClient/ClassesReq";
import { ClassesInfoReq } from "../../../../../WsPackets/src/fromClient/ClassesInfoReq";

export default class ClassesCommandClientTranslator {
	@fromClientTranslator(ClassesReq)
	public static open(_context: PacketContext, _packet: ClassesReq): Promise<CommandClassesPacketReq> {
		return asyncMakePacket(CommandClassesPacketReq, {});
	}

	@fromClientTranslator(ClassesInfoReq)
	public static info(_context: PacketContext, _packet: ClassesInfoReq): Promise<CommandClassesInfoPacketReq> {
		return asyncMakePacket(CommandClassesInfoPacketReq, {});
	}
}
