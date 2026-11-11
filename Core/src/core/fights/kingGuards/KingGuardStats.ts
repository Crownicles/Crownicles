import {
	KingGuardVictory, LogsKingGuardFightsRequests
} from "../../database/logs/requests/LogsKingGuardFightsRequests";
import type Player from "../../database/game/models/Player";
import { KingGuardStates } from "../../database/game/models/KingGuardState";
import { KingGuardDataController } from "../../../data/KingGuard";
import {
	KingGuardDisplay, KingGuardFightStats
} from "../../../../../Lib/src/types/KingGuardFightStats";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";

/**
 * Best guard beaten by a player: the guard with the highest rating today among the ones it beat
 */
export type KingGuardChallenger = KingGuardVictory & {
	glory: number;
};

/**
 * Whether a victory ranks before another one: against a guard with a higher rating, or against the same rating earlier
 */
function ranksBefore(victory: KingGuardChallenger, other: KingGuardChallenger): boolean {
	if (victory.glory !== other.glory) {
		return victory.glory > other.glory;
	}
	if (victory.firstDate !== other.firstDate) {
		return victory.firstDate < other.firstDate;
	}
	return victory.firstFightId < other.firstFightId;
}

/**
 * Rank the players who beat a guard of the library by the current rating of the best guard they beat, ties broken by who beat it first.
 * Since the ratings of the guards keep moving, the best guard of a player and its rank may change without it fighting
 * @param victories - Every guard each player beat
 * @param glories - Current rating of the guards, a guard missing from it being left out
 */
export function rankKingGuardChallengers(victories: KingGuardVictory[], glories: Map<number, number>): KingGuardChallenger[] {
	const bestByPlayer = new Map<string, KingGuardChallenger>();
	for (const victory of victories) {
		const glory = glories.get(victory.guardId);
		if (glory === undefined) {
			continue;
		}
		const challenger = {
			...victory, glory
		};
		const best = bestByPlayer.get(victory.keycloakId);
		if (!best || ranksBefore(challenger, best)) {
			bestByPlayer.set(victory.keycloakId, challenger);
		}
	}
	return [...bestByPlayer.values()].sort((a, b) => ranksBefore(a, b) ? -1 : ranksBefore(b, a) ? 1 : 0);
}

/**
 * How the fronts show a guard of the library, without its rating
 * @param guardId
 */
function toKingGuardDisplay(guardId: number): KingGuardDisplay {
	const guard = KingGuardDataController.instance.getById(guardId)!;
	return {
		id: guard.id,
		level: guard.level,
		classId: guard.classId
	};
}

/**
 * Get the summary of all the fights of a player against the king guards, or null if it never fought one
 * @param player - The keycloak id and the current level of the player
 */
export async function getKingGuardFightStats(player: Pick<Player, "keycloakId" | "level">): Promise<KingGuardFightStats | null> {
	const tally = await LogsKingGuardFightsRequests.getFightTally(player.keycloakId);
	if (tally.played === 0) {
		return null;
	}

	const libraryIds = new Set(KingGuardDataController.instance.getIds());
	const [victories, glories] = await Promise.all([
		LogsKingGuardFightsRequests.getVictories(),
		KingGuardStates.getGlories()
	]);
	const challengers = rankKingGuardChallengers(victories.filter(victory => libraryIds.has(victory.guardId)), glories);
	const viewerIndex = challengers.findIndex(challenger => challenger.keycloakId === player.keycloakId);

	return {
		won: tally.won,
		lost: tally.lost,
		draw: tally.draw,
		playerLevel: player.level,
		...viewerIndex === -1
			? {}
			: {
				record: {
					guard: toKingGuardDisplay(challengers[viewerIndex].guardId),
					rank: viewerIndex + 1,
					challengers: challengers.length
				}
			},
		leaderboard: challengers.slice(0, FightConstants.KING_GUARD.LEADERBOARD_SIZE).map(challenger => ({
			keycloakId: challenger.keycloakId,
			guard: toKingGuardDisplay(challenger.guardId)
		}))
	};
}
