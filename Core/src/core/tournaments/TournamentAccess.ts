import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandTournamentErrorPacketRes, TournamentErrorCode, TournamentErrorCodes
} from "../../../../Lib/src/packets/commands/CommandTournamentPacket";
import { TournamentStatuses } from "../../../../Lib/src/types/Tournament";
import Player from "../database/game/models/Player";
import { processDueTournaments } from "./TournamentLifecycle";
import {
	findTournamentForContext, getParticipant
} from "./TournamentQueries";
import {
	TournamentAccessResult, TournamentAccessResults, type TournamentCommandAccess
} from "./TournamentTypes";
import Tournament from "../database/game/models/Tournament";

function pushError(response: CrowniclesPacket[], errorCode: TournamentErrorCode): void {
	response.push(makePacket(CommandTournamentErrorPacketRes, { errorCode }));
}

function getFightPhaseError(tournament: Tournament): TournamentErrorCode | null {
	switch (tournament.status) {
		case TournamentStatuses.COMBAT:
			return null;
		case TournamentStatuses.REGISTRATION:
			return TournamentErrorCodes.COMBAT_NOT_STARTED;
		case TournamentStatuses.PAUSED:
			return TournamentErrorCodes.PAUSED;
		default:
			return TournamentErrorCodes.INVALID_PHASE;
	}
}

async function verifyFightAccess(
	tournament: Tournament,
	player: Player,
	response: CrowniclesPacket[]
): Promise<TournamentAccessResult> {
	const participant = await getParticipant(tournament.id, player.id);
	if (!participant) {
		pushError(response, TournamentErrorCodes.NOT_REGISTERED);
		return TournamentAccessResults.DENIED;
	}
	const phaseError = getFightPhaseError(tournament);
	if (phaseError) {
		pushError(response, phaseError);
		return TournamentAccessResults.DENIED;
	}
	return TournamentAccessResults.TOURNAMENT_FIGHT;
}

export async function verifyCommandAccess(
	player: Player,
	context: PacketContext,
	response: CrowniclesPacket[],
	access: TournamentCommandAccess
): Promise<TournamentAccessResult> {
	if (access === "bypass") {
		return TournamentAccessResults.ALLOWED;
	}
	await processDueTournaments();
	const tournament = await findTournamentForContext(context, false);
	if (!tournament || access === "status") {
		return TournamentAccessResults.ALLOWED;
	}
	if (access === "none") {
		pushError(response, TournamentErrorCodes.ACCESS_DENIED);
		return TournamentAccessResults.DENIED;
	}
	return await verifyFightAccess(tournament, player, response);
}
