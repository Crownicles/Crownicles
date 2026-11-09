import { fromClientTranslator } from "../FromClientTranslator";
import {
	asyncMakePacket, PacketContext
} from "../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandFightPacketReq, CommandFightResumeReq
} from "../../../../../Lib/src/packets/commands/CommandFightPacket";
import { CommandFriendlyFightPacketReq } from "../../../../../Lib/src/packets/commands/CommandFriendlyFightPacket";
import {
	FightReq, FightResumeReq, FriendlyFightReq
} from "../../../../../WsPackets/src/fromClient/FightReq";
import { referencedKeycloakId } from "../../../services/PlayerReference";

export default class FightClientTranslator {
	@fromClientTranslator(FightResumeReq)
	public static resume(_context: PacketContext, _packet: FightResumeReq): Promise<CommandFightResumeReq> {
		return asyncMakePacket(CommandFightResumeReq, {});
	}

	@fromClientTranslator(FightReq)
	public static start(_context: PacketContext, _packet: FightReq): Promise<CommandFightPacketReq> {
		return asyncMakePacket(CommandFightPacketReq, {});
	}

	@fromClientTranslator(FriendlyFightReq)
	public static friendly(_context: PacketContext, packet: FriendlyFightReq): Promise<CommandFriendlyFightPacketReq> {
		return asyncMakePacket(CommandFriendlyFightPacketReq, { askedPlayer: { keycloakId: referencedKeycloakId(packet.playerRef) } });
	}
}
