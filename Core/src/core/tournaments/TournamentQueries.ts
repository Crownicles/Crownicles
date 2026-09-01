import { Op } from "sequelize";
import { PacketContext } from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	ACTIVE_STATUSES, CONTEXT_STATUSES
} from "./TournamentRules";
import { Tournament } from "../database/game/models/Tournament";
import { TournamentParticipant } from "../database/game/models/TournamentParticipant";

export async function findTournamentForContext(context: PacketContext, includeFinished: boolean): Promise<Tournament | null> {
	if (!Tournament.sequelize) {
		return null;
	}
	const guildId = context.frontEndSubOrigin;
	const channelIds = [context.discord?.channel, context.discord?.parentChannel]
		.filter((channelId): channelId is string => Boolean(channelId));
	if (!guildId || channelIds.length === 0) {
		return null;
	}
	return await Tournament.findOne({
		where: {
			discordGuildId: guildId,
			discordChannelId: { [Op.in]: channelIds },
			status: { [Op.in]: includeFinished ? CONTEXT_STATUSES : ACTIVE_STATUSES }
		},
		order: [["id", "DESC"]]
	});
}

export async function findLatestTournamentForGuild(discordGuildId: string): Promise<Tournament | null> {
	if (!Tournament.sequelize || !discordGuildId) {
		return null;
	}
	return await Tournament.findOne({
		where: {
			discordGuildId,
			status: { [Op.in]: CONTEXT_STATUSES }
		},
		order: [["id", "DESC"]]
	});
}

export async function getParticipant(tournamentId: number, playerId: number): Promise<TournamentParticipant | null> {
	return await TournamentParticipant.findOne({
		where: {
			tournamentId,
			playerId
		}
	});
}
