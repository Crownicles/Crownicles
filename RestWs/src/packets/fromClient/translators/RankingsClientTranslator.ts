import { fromClientTranslator } from "../FromClientTranslator";
import { InvalidClientPacketError } from "../InvalidClientPacketError";
import {
	asyncMakePacket, PacketContext
} from "../../../../../Lib/src/packets/CrowniclesPacket";
import { CommandFightHistoryPacketReq } from "../../../../../Lib/src/packets/commands/CommandFightHistoryPacket";
import {
	CommandLeagueRewardPacketReq, CommandLeagueInfoReq
} from "../../../../../Lib/src/packets/commands/CommandLeagueRewardPacket";
import { CommandTopPacketReq } from "../../../../../Lib/src/packets/commands/CommandTopPacket";
import { TopDataType } from "../../../../../Lib/src/types/TopDataType";
import { TopTiming } from "../../../../../Lib/src/types/TopTimings";
import {
	FightHistoryReq, LeagueRewardReq, LeagueInfoReq, TopReq
} from "../../../../../WsPackets/src/fromClient/RankingsReq";

export default class RankingsClientTranslator {
	@fromClientTranslator(FightHistoryReq)
	public static history(_context: PacketContext, _packet: FightHistoryReq): Promise<CommandFightHistoryPacketReq> {
		return asyncMakePacket(CommandFightHistoryPacketReq, {});
	}

	@fromClientTranslator(LeagueRewardReq)
	public static reward(_context: PacketContext, _packet: LeagueRewardReq): Promise<CommandLeagueRewardPacketReq> {
		return asyncMakePacket(CommandLeagueRewardPacketReq, {});
	}

	@fromClientTranslator(LeagueInfoReq)
	public static leagues(_context: PacketContext, _packet: LeagueInfoReq): Promise<CommandLeagueInfoReq> {
		return asyncMakePacket(CommandLeagueInfoReq, {});
	}

	@fromClientTranslator(TopReq)
	public static top(_context: PacketContext, packet: TopReq): Promise<CommandTopPacketReq> {
		const dataType = Object.values(TopDataType).find(value => value === packet.dataType);
		const timing = Object.values(TopTiming).find(value => value === packet.timing);
		if (!dataType || !timing) {
			throw new InvalidClientPacketError("Invalid ranking type");
		}
		if (packet.page !== undefined && (!Number.isSafeInteger(packet.page) || packet.page < 1)) {
			throw new InvalidClientPacketError("Invalid ranking page");
		}
		return asyncMakePacket(CommandTopPacketReq, {
			dataType, timing, ...packet.page === undefined ? {} : { page: packet.page }
		});
	}
}
