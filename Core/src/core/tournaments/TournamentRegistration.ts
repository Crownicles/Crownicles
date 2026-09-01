import { TournamentConstants } from "../../../../Lib/src/constants/TournamentConstants";
import { TournamentStatuses } from "../../../../Lib/src/types/Tournament";
import { Tournament } from "../database/game/models/Tournament";
import { TournamentParticipant } from "../database/game/models/TournamentParticipant";
import Player from "../database/game/models/Player";
import { processDueTournaments } from "./TournamentLifecycle";
import { findTournamentForContext } from "./TournamentQueries";
import { TournamentDomainError } from "./TournamentErrors";
import { TournamentErrorCodes } from "../../../../Lib/src/packets/commands/CommandTournamentPacket";
import { getCategoryForLevel } from "./TournamentRules";
import { PacketContext } from "../../../../Lib/src/packets/CrowniclesPacket";

function assertRegistrationIsOpen(tournament: Tournament): void {
	if (tournament.status !== TournamentStatuses.REGISTRATION && tournament.status !== TournamentStatuses.COMBAT) {
		throw new TournamentDomainError(TournamentErrorCodes.INVALID_PHASE);
	}
	const now = Date.now();
	if (tournament.status === TournamentStatuses.REGISTRATION && now >= tournament.registrationEndsAt.getTime()) {
		throw new TournamentDomainError(TournamentErrorCodes.INVALID_PHASE);
	}
	if (tournament.status === TournamentStatuses.COMBAT && now >= tournament.combatEndsAt.getTime()) {
		throw new TournamentDomainError(TournamentErrorCodes.INVALID_PHASE);
	}
}

export async function registerPlayer(context: PacketContext, player: Player): Promise<TournamentParticipant> {
	await processDueTournaments();
	const tournament = await findTournamentForContext(context, false);
	if (!tournament || (tournament.status !== TournamentStatuses.REGISTRATION && tournament.status !== TournamentStatuses.COMBAT)) {
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
