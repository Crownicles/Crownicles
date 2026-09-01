import {
	literal, Op
} from "sequelize";
import { FightConstants } from "../../../../Lib/src/constants/FightConstants";
import { TournamentConstants } from "../../../../Lib/src/constants/TournamentConstants";
import {
	asMinutes, minutesToMilliseconds
} from "../../../../Lib/src/utils/TimeUtils";
import { AsyncLock } from "../../../../Lib/src/locks/AsyncLock";
import { Tournament } from "../database/game/models/Tournament";
import { TournamentFight } from "../database/game/models/TournamentFight";
import { TournamentParticipant } from "../database/game/models/TournamentParticipant";

const tournamentDefenderCooldowns = new Map<string, number>();
const tournamentMatchmakingLocks = new Map<number, AsyncLock>();

type MatchmakingState = {
	participant: TournamentParticipant;
	fights: TournamentFight[];
	recentDefenderIds: Set<number>;
	now: number;
};

function getDefenderCooldownKey(tournamentId: number, participantId: number): string {
	return `${tournamentId}:${participantId}`;
}

function getMatchmakingLock(tournamentId: number): AsyncLock {
	let lock = tournamentMatchmakingLocks.get(tournamentId);
	if (!lock) {
		lock = new AsyncLock();
		tournamentMatchmakingLocks.set(tournamentId, lock);
	}
	return lock;
}

function hasFinishedSeries(pairFights: TournamentFight[], participantId: number, candidateId: number): boolean {
	const participantWins = pairFights.filter(fight => fight.winnerParticipantId === participantId).length;
	const candidateWins = pairFights.filter(fight => fight.winnerParticipantId === candidateId).length;
	return pairFights.length >= TournamentConstants.BO3_MAX_GAMES
		|| participantWins >= TournamentConstants.BO3_WINS_TO_FINISH
		|| candidateWins >= TournamentConstants.BO3_WINS_TO_FINISH;
}

function isCandidateAvailable(
	tournamentId: number,
	candidate: TournamentParticipant,
	state: MatchmakingState
): boolean {
	const cooldownKey = getDefenderCooldownKey(tournamentId, candidate.id);
	if ((tournamentDefenderCooldowns.get(cooldownKey) ?? 0) > state.now
		|| state.recentDefenderIds.has(candidate.id)) {
		return false;
	}
	const pairFights = state.fights.filter(fight =>
		(fight.attackerParticipantId === state.participant.id && fight.defenderParticipantId === candidate.id)
		|| (fight.attackerParticipantId === candidate.id && fight.defenderParticipantId === state.participant.id));
	return !hasFinishedSeries(pairFights, state.participant.id, candidate.id);
}

export async function findOpponent(
	tournament: Tournament,
	participant: TournamentParticipant
): Promise<TournamentParticipant | null> {
	const candidates = await TournamentParticipant.findAll({
		where: {
			tournamentId: tournament.id,
			category: participant.category,
			id: { [Op.ne]: participant.id }
		},
		order: [[literal(`ABS(defenseGloryPoints - ${participant.attackGloryPoints})`), "ASC"], ["registeredAt", "ASC"]]
	});
	if (candidates.length === 0) {
		return null;
	}
	const candidateIds = candidates.map(candidate => candidate.id);
	const [fights, recentDefenses] = await Promise.all([
		TournamentFight.findAll({
			where: {
				tournamentId: tournament.id,
				[Op.or]: [
					{
						attackerParticipantId: participant.id,
						defenderParticipantId: { [Op.in]: candidateIds }
					},
					{
						defenderParticipantId: participant.id,
						attackerParticipantId: { [Op.in]: candidateIds }
					}
				]
			}
		}),
		TournamentFight.findAll({
			where: {
				tournamentId: tournament.id,
				defenderParticipantId: { [Op.in]: candidateIds },
				playedAt: {
					[Op.gt]: new Date(Date.now() - minutesToMilliseconds(asMinutes(FightConstants.DEFENDER_COOLDOWN_MINUTES)))
				}
			}
		})
	]);
	const state: MatchmakingState = {
		participant,
		fights,
		recentDefenderIds: new Set(recentDefenses.map(fight => fight.defenderParticipantId)),
		now: Date.now()
	};
	return candidates.find(candidate => isCandidateAvailable(tournament.id, candidate, state)) ?? null;
}

export async function findAndReserveOpponent(
	tournament: Tournament,
	participant: TournamentParticipant
): Promise<TournamentParticipant | null> {
	const release = await getMatchmakingLock(tournament.id).acquire();
	try {
		const opponent = await findOpponent(tournament, participant);
		if (opponent) {
			reserveDefender(tournament.id, opponent.id);
		}
		return opponent;
	}
	finally {
		release();
	}
}

export function reserveDefender(tournamentId: number, participantId: number): void {
	tournamentDefenderCooldowns.set(
		getDefenderCooldownKey(tournamentId, participantId),
		Date.now() + minutesToMilliseconds(asMinutes(FightConstants.DEFENDER_COOLDOWN_MINUTES))
	);
}
