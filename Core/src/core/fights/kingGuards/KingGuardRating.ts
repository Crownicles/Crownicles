import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";
import { EloGameResult } from "../../../../../Lib/src/types/EloGameResult";
import { KingGuardDataController } from "../../../data/KingGuard";
import { EloUtils } from "../../utils/EloUtils";
import { median } from "../../../../../Lib/src/utils/MathUtils";

/**
 * Hidden ratings of a player and of the guard it fights
 */
export type KingGuardRatings = {
	player: number;
	guard: number;
};

/**
 * Ratings before a fight against a king guard and their change, as logged
 */
export type KingGuardRatingChange = {
	playerGuardGlory: number;
	playerGuardGloryChange: number;
	guardGlory: number;
	guardGloryChange: number;
};

/**
 * Rating a player starts from against the king guards: the median initial rating of the guards of its level,
 * so that a strong player does not have to beat a series of weak guards first
 * @param playerLevel
 */
export function getInitialPlayerGuardGlory(playerLevel: number): number {
	return Math.round(median(KingGuardDataController.instance.getOfClosestLevel(playerLevel).map(guard => guard.initialGlory)));
}

/**
 * K factor of a player against the king guards: higher during its first rated fights so that its rating settles quickly
 * @param ratedFightsCount - Number of fights against a guard of the library the player already played
 */
export function getPlayerKingGuardKFactor(ratedFightsCount: number): number {
	const {
		PROVISIONAL_FIGHTS, PROVISIONAL_PLAYER_K_FACTOR, PLAYER_K_FACTOR
	} = FightConstants.KING_GUARD.RATING;
	return ratedFightsCount < PROVISIONAL_FIGHTS ? PROVISIONAL_PLAYER_K_FACTOR : PLAYER_K_FACTOR;
}

/**
 * Compute how the ratings of a player and of the guard it fought change with the result of the fight (Elo)
 * @param before - Ratings before the fight
 * @param playerResult - Result of the fight for the player
 * @param playerKFactor - See getPlayerKingGuardKFactor
 */
export function computeKingGuardRatingChange(before: KingGuardRatings, playerResult: EloGameResult, playerKFactor: number): KingGuardRatingChange {
	const guardResult = 1 - playerResult;
	return {
		playerGuardGlory: before.player,
		playerGuardGloryChange: Math.round(playerKFactor * (playerResult - EloUtils.getExpectedScore(before.player, before.guard))),
		guardGlory: before.guard,
		guardGloryChange: Math.round(FightConstants.KING_GUARD.RATING.GUARD_K_FACTOR * (guardResult - EloUtils.getExpectedScore(before.guard, before.player)))
	};
}
