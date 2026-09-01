import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandTournamentErrorPacketRes, TournamentErrorCodes
} from "../../../../Lib/src/packets/commands/CommandTournamentPacket";
import { TournamentStatuses } from "../../../../Lib/src/types/Tournament";
import Player from "../database/game/models/Player";
import { processDueTournaments } from "./TournamentLifecycle";
import {
	findTournamentForContext, getParticipant
} from "./TournamentQueries";
import type { TournamentCommandAccess } from "./TournamentTypes";
import Tournament from "../database/game/models/Tournament";

function pushError(response: CrowniclesPacket[], errorCode: typeof TournamentErrorCodes[keyof typeof TournamentErrorCodes]): void {
	response.push(makePacket(CommandTournamentErrorPacketRes, { errorCode }));
}

function isRegistrationOpen(tournament: Tournament): boolean {
	return tournament.status === TournamentStatuses.REGISTRATION || tournament.status === TournamentStatuses.COMBAT;
}

function verifyRegistrationAccess(tournament: Tournament, response: CrowniclesPacket[]): boolean {
	if (isRegistrationOpen(tournament)) {
		return true;
	}
	pushError(response, tournament.status === TournamentStatuses.PAUSED
		? TournamentErrorCodes.PAUSED
		: TournamentErrorCodes.INVALID_PHASE);
	return false;
}

async function verifyParticipantAccess(
	tournament: Tournament,
	player: Player,
	response: CrowniclesPacket[],
	access: TournamentCommandAccess
): Promise<boolean> {
	if (tournament.status === TournamentStatuses.PAUSED && access !== "participant") {
		pushError(response, TournamentErrorCodes.PAUSED);
		return false;
	}
	const participant = await getParticipant(tournament.id, player.id);
	if (!participant) {
		pushError(response, TournamentErrorCodes.NOT_REGISTERED);
		return false;
	}
	if (access === "fight" && tournament.status !== TournamentStatuses.COMBAT) {
		pushError(response, TournamentErrorCodes.INVALID_PHASE);
		return false;
	}
	return true;
}

export async function verifyCommandAccess(
	player: Player,
	context: PacketContext,
	response: CrowniclesPacket[],
	access: TournamentCommandAccess
): Promise<boolean> {
	await processDueTournaments();
	const tournament = await findTournamentForContext(context, true);
	if (!tournament) {
		return true;
	}
	if (access === "none") {
		pushError(response, TournamentErrorCodes.ACCESS_DENIED);
		return false;
	}
	if (access === "registration") {
		return verifyRegistrationAccess(tournament, response);
	}
	return await verifyParticipantAccess(tournament, player, response, access);
}
