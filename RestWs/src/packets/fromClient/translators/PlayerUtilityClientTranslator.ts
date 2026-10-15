import { fromClientTranslator } from "../FromClientTranslator";
import {
	asyncMakePacket, PacketContext
} from "../../../../../Lib/src/packets/CrowniclesPacket";
import { CommandRespawnPacketReq } from "../../../../../Lib/src/packets/commands/CommandRespawnPacket";
import { CommandUnlockPacketReq } from "../../../../../Lib/src/packets/commands/CommandUnlockPacket";
import { CommandJoinBoatPacketReq } from "../../../../../Lib/src/packets/commands/CommandJoinBoatPacket";
import { CommandUpdatePacketReq } from "../../../../../Lib/src/packets/commands/CommandUpdatePacket";
import {
	RespawnReq, UnlockReq, JoinBoatReq, VersionReq
} from "../../../../../WsPackets/src/fromClient/PlayerUtilityReq";
import { InvalidClientPacketError } from "../InvalidClientPacketError";

export default class PlayerUtilityClientTranslator {
	@fromClientTranslator(RespawnReq)
	public static respawn(_context: PacketContext, _packet: RespawnReq): Promise<CommandRespawnPacketReq> {
		return asyncMakePacket(CommandRespawnPacketReq, {});
	}

	@fromClientTranslator(UnlockReq)
	public static unlock(_context: PacketContext, packet: UnlockReq): Promise<CommandUnlockPacketReq> {
		if (!Number.isSafeInteger(packet.rank) || packet.rank < 1) {
			throw new InvalidClientPacketError("Invalid prisoner rank");
		}
		return asyncMakePacket(CommandUnlockPacketReq, { askedPlayer: { rank: packet.rank } });
	}

	@fromClientTranslator(JoinBoatReq)
	public static boat(_context: PacketContext, _packet: JoinBoatReq): Promise<CommandJoinBoatPacketReq> {
		return asyncMakePacket(CommandJoinBoatPacketReq, {});
	}

	@fromClientTranslator(VersionReq)
	public static version(_context: PacketContext, _packet: VersionReq): Promise<CommandUpdatePacketReq> {
		return asyncMakePacket(CommandUpdatePacketReq, {});
	}
}
