import { fromServerTranslator } from "../FromServerTranslator";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { CommandFightHistoryPacketRes } from "../../../../../Lib/src/packets/commands/CommandFightHistoryPacket";
import {
	CommandLeagueInfoRes, CommandLeagueRewardSuccessPacketRes, CommandLeagueRewardAlreadyClaimedPacketRes,
	CommandLeagueRewardNoPointsPacketRes, CommandLeagueRewardNotSundayPacketRes
} from "../../../../../Lib/src/packets/commands/CommandLeagueRewardPacket";
import {
	CommandTopPacketResScore, CommandTopPacketResGlory, CommandTopPacketResGuild, CommandTopPlayersEmptyPacket, CommandTopGuildsEmptyPacket
} from "../../../../../Lib/src/packets/commands/CommandTopPacket";
import {
	FightHistoryRes, LeagueInfoRes, LeagueRewardRes, TopRes, TopEmptyRes
} from "../../../../../WsPackets/src/fromServer/fight/RankingsRes";
import {
	TopDataType, RankingEntry
} from "../../../../../WsPackets/src/objects/Rankings";
import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";
import { resolvePlayerName } from "../PlayerDisplay";
import {
	TopElementScore, TopElementGlory
} from "../../../../../Lib/src/types/TopElement";

type TopPacket = CommandTopPacketResScore | CommandTopPacketResGlory | CommandTopPacketResGuild;

function topPage(packet: TopPacket, dataType: TopDataType, elements: RankingEntry[], needFight?: number): Promise<TopRes> {
	return asyncMakeFromServerPacket(TopRes, {
		dataType,
		elements,
		timing: packet.timing,
		canBeRanked: packet.canBeRanked,
		totalElements: packet.totalElements,
		elementsPerPage: packet.elementsPerPage,
		pageNumber: packet.pageNumber,
		...packet.contextRank === undefined ? {} : { contextRank: packet.contextRank },
		...needFight === undefined ? {} : { needFight }
	});
}

async function playerRankingEntry(entry: TopElementScore | TopElementGlory): Promise<RankingEntry> {
	return {
		rank: entry.rank,
		sameContext: entry.sameContext,
		name: await resolvePlayerName(entry.text) ?? "",
		value: entry.attributes[2],
		level: entry.attributes[3],
		...typeof entry.attributes[1] === "number" ? { leagueId: entry.attributes[1] } : entry.attributes[1]
	};
}

export default class RankingsServerTranslator {
	@fromServerTranslator(CommandFightHistoryPacketRes, FightHistoryRes)
	public static async history(_context: PacketContext, packet: CommandFightHistoryPacketRes): Promise<FightHistoryRes> {
		return asyncMakeFromServerPacket(FightHistoryRes, { history: await Promise.all(packet.history.map(async entry => {
			const {
				opponentKeycloakId, ...details
			} = entry;
			const opponentName = await resolvePlayerName(opponentKeycloakId);
			return {
				...details, ...opponentName ? { opponentName } : {}
			};
		})) });
	}

	@fromServerTranslator(CommandLeagueInfoRes, LeagueInfoRes)
	public static leagues(_context: PacketContext, packet: CommandLeagueInfoRes): Promise<LeagueInfoRes> {
		return asyncMakeFromServerPacket(LeagueInfoRes, { ...packet });
	}

	@fromServerTranslator(CommandLeagueRewardSuccessPacketRes, LeagueRewardRes)
	public static reward(_context: PacketContext, packet: CommandLeagueRewardSuccessPacketRes): Promise<LeagueRewardRes> {
		return asyncMakeFromServerPacket(LeagueRewardRes, { outcome: {
			type: "success", ...packet
		} });
	}

	@fromServerTranslator(CommandLeagueRewardAlreadyClaimedPacketRes, LeagueRewardRes)
	public static claimed(_context: PacketContext, _packet: CommandLeagueRewardAlreadyClaimedPacketRes): Promise<LeagueRewardRes> {
		return asyncMakeFromServerPacket(LeagueRewardRes, { outcome: { type: "alreadyClaimed" } });
	}

	@fromServerTranslator(CommandLeagueRewardNoPointsPacketRes, LeagueRewardRes)
	public static noPoints(_context: PacketContext, _packet: CommandLeagueRewardNoPointsPacketRes): Promise<LeagueRewardRes> {
		return asyncMakeFromServerPacket(LeagueRewardRes, { outcome: { type: "noPoints" } });
	}

	@fromServerTranslator(CommandLeagueRewardNotSundayPacketRes, LeagueRewardRes)
	public static notSunday(_context: PacketContext, packet: CommandLeagueRewardNotSundayPacketRes): Promise<LeagueRewardRes> {
		return asyncMakeFromServerPacket(LeagueRewardRes, { outcome: {
			type: "notSunday", nextSunday: packet.nextSunday
		} });
	}

	@fromServerTranslator(CommandTopPacketResScore, TopRes)
	public static async score(_context: PacketContext, packet: CommandTopPacketResScore): Promise<TopRes> {
		const elements = await Promise.all(packet.elements.map(playerRankingEntry));
		return topPage(packet, TopDataType.SCORE, elements);
	}

	@fromServerTranslator(CommandTopPacketResGlory, TopRes)
	public static async glory(_context: PacketContext, packet: CommandTopPacketResGlory): Promise<TopRes> {
		const elements = await Promise.all(packet.elements.map(playerRankingEntry));
		return topPage(packet, TopDataType.GLORY, elements, packet.needFight);
	}

	@fromServerTranslator(CommandTopPacketResGuild, TopRes)
	public static guild(_context: PacketContext, packet: CommandTopPacketResGuild): Promise<TopRes> {
		return topPage(packet, TopDataType.GUILD, packet.elements.map(entry => ({
			rank: entry.rank, sameContext: entry.sameContext, name: entry.text, value: entry.attributes[1], level: entry.attributes[2]
		})));
	}

	@fromServerTranslator(CommandTopPlayersEmptyPacket, TopEmptyRes)
	public static noPlayers(_context: PacketContext, packet: CommandTopPlayersEmptyPacket): Promise<TopEmptyRes> {
		return asyncMakeFromServerPacket(TopEmptyRes, packet.needFight === undefined ? {} : { needFight: packet.needFight });
	}

	@fromServerTranslator(CommandTopGuildsEmptyPacket, TopEmptyRes)
	public static noGuilds(_context: PacketContext, _packet: CommandTopGuildsEmptyPacket): Promise<TopEmptyRes> {
		return asyncMakeFromServerPacket(TopEmptyRes, {});
	}
}
