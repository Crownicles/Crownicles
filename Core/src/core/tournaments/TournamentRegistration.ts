import { TournamentConstants } from "../../../../Lib/src/constants/TournamentConstants";
import {
	TournamentStatuses, TournamentStatus
} from "../../../../Lib/src/types/Tournament";
import { Tournament } from "../database/game/models/Tournament";
import { TournamentParticipant } from "../database/game/models/TournamentParticipant";
import Player from "../database/game/models/Player";
import { processDueTournaments } from "./TournamentLifecycle";
import { findTournamentForContext } from "./TournamentQueries";
import { TournamentDomainError } from "./TournamentErrors";
import { TournamentErrorCodes } from "../../../../Lib/src/packets/commands/CommandTournamentPacket";
import { getCategoryForLevel } from "./TournamentRules";
import { PacketContext } from "../../../../Lib/src/packets/CrowniclesPacket";

function isRegistrationStatus(status: TournamentStatus): status is typeof TournamentStatuses.REGISTRATION | typeof TournamentStatuses.COMBAT {
	return status === TournamentStatuses.REGISTRATION || status === TournamentStatuses.COMBAT;
}

function getRegistrationDeadline(tournament: Tournament): Date | null {
	switch (tournament.status) {
		case TournamentStatuses.REGISTRATION:
			return tournament.registrationEndsAt;
		case TournamentStatuses.COMBAT:
			return tournament.combatEndsAt;
		default:
			return null;
	}
}

function assertRegistrationIsOpen(tournament: Tournament): void {
	const deadline = getRegistrationDeadline(tournament);
	if (!deadline || Date.now() >= deadline.getTime()) {
		throw new TournamentDomainError(TournamentErrorCodes.INVALID_PHASE);
	}
}

export async function registerPlayer(context: PacketContext, player: Player): Promise<TournamentParticipant> {
	await processDueTournaments();
	const tournament = await findTournamentForContext(context, false);
	if (!tournament || !isRegistrationStatus(tournament.status)) {
		throw new TournamentDomainError(TournamentErrorCodes.NOT_FOUND);
	}

	return await Tournament.withLocked(tournament.id, async lockedTournament => {
		assertRegistrationIsOpen(lockedTournament);
		const existing = await TournamentParticipant.findOne({
			where: {
				tournamentId: lockedTournament.id,
				playerId: player.id
			}
		});
		if (existing) {
			throw new TournamentDomainError(TournamentErrorCodes.ALREADY_REGISTERED);
		}

		const lateRegistration = lockedTournament.status === TournamentStatuses.COMBAT;
		return await TournamentParticipant.create({
			tournamentId: lockedTournament.id,
			playerId: player.id,
			keycloakId: player.keycloakId,
			category: getCategoryForLevel(player.level),
			lateRegistration,
			normalLeagueId: player.getLeague().id,
			attackGloryPoints: TournamentConstants.INITIAL_ATTACK_GLORY,
			defenseGloryPoints: lateRegistration
				? TournamentConstants.LATE_INITIAL_DEFENSE_GLORY
				: TournamentConstants.INITIAL_DEFENSE_GLORY,
			finalRank: null,
			isWinner: false,
			rewardXp: 0,
			rewardMoney: 0,
			rewardItemCount: 0,
			rewardGrantedAt: null,
			registeredAt: new Date()
		});
	});
}
