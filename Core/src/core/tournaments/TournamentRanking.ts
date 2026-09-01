import { Op } from "sequelize";
import { PacketContext } from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	TournamentCategories
} from "../../../../Lib/src/types/Tournament";
import { TournamentConstants } from "../../../../Lib/src/constants/TournamentConstants";
import { TournamentParticipant } from "../database/game/models/TournamentParticipant";
import Player from "../database/game/models/Player";
import {
	getCategoryCounts, getEffectiveLevel, sortParticipants,
	TournamentStatusData, TournamentTopData
} from "./TournamentRules";
import { findTournamentForContext } from "./TournamentQueries";
import { TournamentDomainError } from "./TournamentErrors";
import { TournamentErrorCodes } from "../../../../Lib/src/packets/commands/CommandTournamentPacket";

export async function getStatusData(context: PacketContext, player: Player): Promise<TournamentStatusData> {
	const tournament = await findTournamentForContext(context, true);
	if (!tournament) {
		throw new TournamentDomainError(TournamentErrorCodes.NOT_FOUND);
	}
	const participants = await TournamentParticipant.findAll({
		where: { tournamentId: tournament.id }
	});
	const participant = participants.find(candidate => candidate.playerId === player.id);
	return {
		tournamentId: tournament.id,
		status: tournament.status,
		registrationEndsAt: tournament.registrationEndsAt.getTime(),
		combatEndsAt: tournament.combatEndsAt.getTime(),
		participantCount: participants.length,
		categoryCounts: getCategoryCounts(participants),
		category: participant?.category,
		attackGloryPoints: participant?.attackGloryPoints,
		defenseGloryPoints: participant?.defenseGloryPoints
	};
}

export async function getTopData(context: PacketContext, player: Player, requestedPage?: number): Promise<TournamentTopData> {
	const tournament = await findTournamentForContext(context, true);
	if (!tournament) {
		throw new TournamentDomainError(TournamentErrorCodes.NOT_FOUND);
	}
	const participants = await TournamentParticipant.findAll({ where: { tournamentId: tournament.id } });
	const playerInstances = await Player.findAll({
		where: { id: { [Op.in]: participants.map(participant => participant.playerId) } }
	});
	const playersById = new Map(playerInstances.map(playerInstance => [playerInstance.id, playerInstance]));
	const sortedParticipantsByCategory = Object.values(TournamentCategories).map(category => ({
		category,
		participants: sortParticipants(participants.filter(participant => participant.category === category), playersById)
	}));
	const totalParticipants = Math.max(0, ...sortedParticipantsByCategory.map(category => category.participants.length));
	const totalPages = Math.max(1, Math.ceil(totalParticipants / TournamentConstants.TOP_ELEMENTS_PER_PAGE));
	const pageNumber = Math.min(Math.max(requestedPage ?? 1, 1), totalPages);
	const pageStart = (pageNumber - 1) * TournamentConstants.TOP_ELEMENTS_PER_PAGE;
	return {
		tournamentId: tournament.id,
		pageNumber,
		totalPages,
		elementsPerPage: TournamentConstants.TOP_ELEMENTS_PER_PAGE,
		categories: sortedParticipantsByCategory.map(({
			category, participants: categoryParticipants
		}) => {
			const pageParticipants = categoryParticipants.slice(pageStart, pageStart + TournamentConstants.TOP_ELEMENTS_PER_PAGE);
			return {
				category,
				totalParticipants: categoryParticipants.length,
				yourRank: categoryParticipants.findIndex(participant => participant.playerId === player.id) + 1 || undefined,
				elements: pageParticipants.map((participant, index) => ({
					playerKeycloakId: participant.keycloakId,
					rank: pageStart + index + 1,
					category,
					attackGloryPoints: participant.attackGloryPoints,
					defenseGloryPoints: participant.defenseGloryPoints,
					totalGloryPoints: participant.getTotalGloryPoints(),
					effectiveLevel: getEffectiveLevel(category, playersById.get(participant.playerId)?.level ?? 0)
				}))
			};
		})
	};
}
