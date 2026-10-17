import { Op } from "sequelize";
import { PacketContext } from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	ACTIVE_STATUSES, CONTEXT_STATUSES
} from "./TournamentRules";
import { Tournament } from "../database/game/models/Tournament";
import { TournamentParticipant } from "../database/game/models/TournamentParticipant";
import { TournamentCode } from "../database/game/models/TournamentCode";
import {
	TournamentStatuses, type TournamentMenuSummary
} from "../../../../Lib/src/types/Tournament";

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

async function toTournamentMenuSummary(tournament: Tournament): Promise<TournamentMenuSummary> {
	return {
		id: tournament.id,
		status: tournament.status,
		discordChannelId: tournament.discordChannelId,
		registrationEndsAt: tournament.registrationEndsAt.getTime(),
		combatEndsAt: tournament.combatEndsAt.getTime(),
		participantCount: await TournamentParticipant.count({
			where: { tournamentId: tournament.id }
		})
	};
}

export async function getTournamentAdminMenuData(discordGuildId: string): Promise<{
	tournaments: TournamentMenuSummary[];
	hasAvailableCode: boolean;
}> {
	const tournaments = await Tournament.findAll({
		where: {
			discordGuildId,
			status: { [Op.in]: ACTIVE_STATUSES }
		},
		order: [["id", "DESC"]]
	});
	const availableCode = await TournamentCode.findOne({
		where: {
			discordGuildId,
			consumedAt: null,
			expiresAt: { [Op.gt]: new Date() }
		},
		order: [["id", "DESC"]]
	});
	return {
		tournaments: await Promise.all(tournaments.map(toTournamentMenuSummary)),
		hasAvailableCode: availableCode !== null
	};
}

export async function getTournamentOwnerMenuData(discordGuildId: string): Promise<{
	pausedTournaments: TournamentMenuSummary[];
}> {
	const tournaments = await Tournament.findAll({
		where: {
			discordGuildId,
			status: TournamentStatuses.PAUSED
		},
		order: [["id", "DESC"]]
	});
	return {
		pausedTournaments: await Promise.all(tournaments.map(toTournamentMenuSummary))
	};
}
