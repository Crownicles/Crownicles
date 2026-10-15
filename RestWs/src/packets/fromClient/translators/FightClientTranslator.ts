import { fromClientTranslator } from "../FromClientTranslator";
import {
	asyncMakePacket, PacketContext
} from "../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandFightPacketReq, CommandFightResumeReq
} from "../../../../../Lib/src/packets/commands/CommandFightPacket";
import {
	FightReq, FightResumeReq
} from "../../../../../WsPackets/src/fromClient/FightReq";

export default class FightClientTranslator {
	@fromClientTranslator(FightResumeReq)
	public static resume(_context: PacketContext, _packet: FightResumeReq): Promise<CommandFightResumeReq> {
		return asyncMakePacket(CommandFightResumeReq, {});
	}

	@fromClientTranslator(FightReq)
	public static start(_context: PacketContext, _packet: FightReq): Promise<CommandFightPacketReq> {
		return asyncMakePacket(CommandFightPacketReq, {});
	}
}
