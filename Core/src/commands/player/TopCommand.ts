import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import Player, { Players } from "../../core/database/game/models/Player";
import {
	CommandTopGuildsEmptyPacket,
	CommandTopInvalidPagePacket,
	CommandTopPacketReq,
	CommandTopPacketResGlory,
	CommandTopPacketResGuild,
	CommandTopPacketResScore,
	CommandTopPlayersEmptyPacket
} from "../../../../Lib/src/packets/commands/CommandTopPacket";
import { TopTiming } from "../../../../Lib/src/types/TopTimings";
import { TopConstants } from "../../../../Lib/src/constants/TopConstants";
import { Constants } from "../../../../Lib/src/constants/Constants";
import { TopDataType } from "../../../../Lib/src/types/TopDataType";
import { ErrorPacket } from "../../../../Lib/src/packets/commands/ErrorPacket";
import { FightConstants } from "../../../../Lib/src/constants/FightConstants";
import { Guilds } from "../../core/database/game/models/Guild";
import { TravelTime } from "../../core/maps/TravelTime";

async function getTopScore(initiator: Player, page: number, timing: TopTiming): Promise<CrowniclesPacket> {
	const totalElements = await Players.getNumberOfPlayingPlayers(timing === TopTiming.WEEK);
	if (totalElements === 0) {
		return makePacket(CommandTopPlayersEmptyPacket, {});
	}
	const maxPage = Math.ceil(totalElements / TopConstants.PLAYERS_PER_PAGE);

	if (page < 1 || page > maxPage) {
		return makePacket(CommandTopInvalidPagePacket, {
			minPage: 1,
			maxPage
		});
	}

	const minRank = (page - 1) * TopConstants.PLAYERS_PER_PAGE + 1;
	const maxRank = Math.min(page * TopConstants.PLAYERS_PER_PAGE, totalElements);
	const rank = timing === TopTiming.WEEK
		? initiator.weeklyScore <= Constants.MINIMAL_PLAYER_SCORE
			? -1
			: await Players.getWeeklyRankById(initiator.id)
		: initiator.score <= Constants.MINIMAL_PLAYER_SCORE
			? -1
			: await Players.getRankById(initiator.id);

	const players = await Players.getPlayersTop(minRank, maxRank, timing === TopTiming.WEEK);
	const now = Date.now();

	return makePacket(CommandTopPacketResScore, {
		totalElements,
		timing,
		minRank,
		maxRank,
		contextRank: rank > 0 ? rank : undefined,
		canBeRanked: true,
		elements: players.map((player, index) => ({
			rank: minRank + index,
			sameContext: initiator.id === player.id,
			text: player.keycloakId,
			attributes: {
				1: {
					effectId: player.currentEffectFinished(new Date(now)) ? undefined : player.effectId,
					mapType: TravelTime.getTravelDataSimplified(player, new Date(now)).travelEndTime > now ? undefined : player.getDestination()?.type,
					afk: player.isInactive()
				},
				2: timing === TopTiming.WEEK ? player.weeklyScore : player.score,
				3: player.level
			}
		})),
		elementsPerPage: TopConstants.PLAYERS_PER_PAGE
	});
}

async function getTopGlory(initiator: Player, page: number): Promise<CrowniclesPacket> {
	const totalElements = await Players.getNumberOfFightingPlayers();
	if (totalElements === 0) {
		return makePacket(CommandTopPlayersEmptyPacket, {
			needFight: initiator.fightCountdown - FightConstants.FIGHT_COUNTDOWN_MAXIMAL_VALUE
		});
	}
	const maxPage = Math.ceil(totalElements / TopConstants.PLAYERS_PER_PAGE);

	if (page < 1 || page > maxPage) {
		return makePacket(CommandTopInvalidPagePacket, {
			minPage: 1,
			maxPage
		});
	}

	const minRank = (page - 1) * TopConstants.PLAYERS_PER_PAGE + 1;
	const maxRank = Math.min(page * TopConstants.PLAYERS_PER_PAGE, totalElements);
	const rank = initiator.fightCountdown > FightConstants.FIGHT_COUNTDOWN_MAXIMAL_VALUE ? -1 : await Players.getGloryRankById(initiator.id);

	const players = await Players.getPlayersGloryTop(minRank, maxRank);

	return makePacket(CommandTopPacketResGlory, {
		totalElements,
		timing: TopTiming.WEEK,
		minRank,
		maxRank,
		contextRank: rank > 0 ? rank : undefined,
		canBeRanked: true,
		needFight: initiator.fightCountdown - FightConstants.FIGHT_COUNTDOWN_MAXIMAL_VALUE,
		elements: players.map((player, index) => ({
			rank: minRank + index,
			sameContext: initiator.id === player.id,
			text: player.keycloakId,
			attributes: {
				1: player.getLeague().id,
				2: player.getGloryPoints(),
				3: player.level
			}
		})),
		elementsPerPage: TopConstants.GUILDS_PER_PAGE
	});
}

async function getTopGuild(initiator: Player, page: number): Promise<CrowniclesPacket> {
	const totalElements = await Guilds.getTotalRanked();
	if (totalElements === 0) {
		return makePacket(CommandTopGuildsEmptyPacket, {});
	}
	const maxPage = Math.ceil(totalElements / TopConstants.GUILDS_PER_PAGE);

	if (page < 1 || page > maxPage) {
		return makePacket(CommandTopInvalidPagePacket, {
			minPage: 1,
			maxPage
		});
	}

	const minRank = (page - 1) * TopConstants.GUILDS_PER_PAGE + 1;
	const maxRank = Math.min(page * TopConstants.GUILDS_PER_PAGE, totalElements);
	const playerGuild = initiator.guildId === null ? null : await Guilds.getById(initiator.guildId);
	const rank = playerGuild ? await playerGuild.getRanking() : -1;

	const guilds = await Guilds.getRankedGuilds(minRank, maxRank);

	return makePacket(CommandTopPacketResGuild, {
		totalElements,
		timing: TopTiming.ALL_TIME,
		minRank,
		maxRank,
		contextRank: rank > 0 ? rank : undefined,
		canBeRanked: initiator.guildId !== null,
		elements: guilds.map((guild, index) => ({
			rank: minRank + index,
			sameContext: initiator.guildId === guild.id,
			text: guild.name,
			attributes: {
				1: guild.score,
				2: guild.level,
				3: undefined as undefined
			}
		})),
		elementsPerPage: TopConstants.PLAYERS_PER_PAGE
	});
}

export default class TopCommand {
	@commandRequires(CommandTopPacketReq, {
		notBlocked: false,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE
	})
	static async execute(
		response: CrowniclesPacket[],
		player: Player,
		packet: CommandTopPacketReq
	): Promise<void> {
		switch (packet.dataType) {
			case TopDataType.SCORE:
				response.push(await getTopScore(player, packet.page ?? 1, packet.timing));
				break;
			case TopDataType.GLORY:
				response.push(await getTopGlory(player, packet.page ?? 1));
				break;
			case TopDataType.GUILD:
				response.push(await getTopGuild(player, packet.page ?? 1));
				break;
			default:
				response.push(makePacket(ErrorPacket, { message: "Invalid top data type. This error shouldn't happen. If it does, please report it." }));
		}
	}
}
