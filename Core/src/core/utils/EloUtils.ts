import Player from "../database/game/models/Player";
import { FightConstants } from "../../../../Lib/src/constants/FightConstants";
import { EloGameResult } from "../../../../Lib/src/types/EloGameResult";
import { LeagueInfoConstants } from "../../../../Lib/src/constants/LeagueInfoConstants";
import { InactivityKFactorBoost } from "../../../../Lib/src/types/InactivityKFactorBoost";

export abstract class EloUtils {
	/**
	 * Get the k-factor of a player
	 * @param player
	 */
	static getKFactor(player: Player): number {
		const glory = player.getGloryPoints();

		if (glory < FightConstants.ELO.LOW_K_FACTOR_THRESHOLD) {
			return FightConstants.ELO.DEFAULT_K_FACTOR;
		}

		if (glory < FightConstants.ELO.VERY_LOW_K_FACTOR_THRESHOLD) {
			return FightConstants.ELO.LOW_K_FACTOR;
		}

		if (glory < FightConstants.ELO.ULTRA_LOW_K_FACTOR_THRESHOLD) {
			return FightConstants.ELO.VERY_LOW_K_FACTOR;
		}

		if (glory < FightConstants.ELO.MINIMAL_K_FACTOR_THRESHOLD) {
			return FightConstants.ELO.ULTRA_LOW_K_FACTOR;
		}

		return FightConstants.ELO.MINIMAL_K_FACTOR;
	}

	/**
	 * Get the k-factor of a player, boosted when their rating was rarely put at stake recently
	 * @param player
	 * @param fightCountInWindow - Number of ranked fights counted in the last `boost.WINDOW_WEEKS` weeks
	 * @param boost - Boost rule of the rating at stake
	 */
	private static getInactivityBoostedKFactor(player: Player, fightCountInWindow: number, boost: InactivityKFactorBoost): number {
		const baseFactor = EloUtils.getKFactor(player);
		const countdown = Math.max(0, boost.FIGHT_COUNT_THRESHOLD - fightCountInWindow);
		if (countdown < boost.COUNTDOWN_THRESHOLD || player.getLeague().id >= LeagueInfoConstants.ROYAL_LEAGUE_ID) {
			return baseFactor;
		}
		return baseFactor * Math.min(countdown - 1, boost.K_FACTOR_MAX_MULTIPLIER);
	}

	/**
	 * Get the k-factor for an attacker, boosted when the attacker is returning from inactivity.
	 * This is a custom Crownicles balancing rule to help stale attacker ratings converge faster:
	 * fewer ranked fights initiated in the window means a higher multiplier.
	 * @param attacker
	 * @param attackCountInWindow - Number of ranked fights initiated in the last INACTIVE_ATTACKER.WINDOW_WEEKS weeks
	 */
	static getAttackerKFactor(attacker: Player, attackCountInWindow: number): number {
		return EloUtils.getInactivityBoostedKFactor(attacker, attackCountInWindow, FightConstants.ELO.INACTIVE_ATTACKER);
	}

	/**
	 * Get the k-factor for a defender, boosted when the defender was rarely attacked recently.
	 * Only fights update a defense rating, so the one of a rarely attacked player would otherwise stay stale for months.
	 * @param defender
	 * @param defenseCountInWindow - Number of ranked fights undergone in the last INACTIVE_DEFENDER.WINDOW_WEEKS weeks
	 */
	static getDefenderKFactor(defender: Player, defenseCountInWindow: number): number {
		return EloUtils.getInactivityBoostedKFactor(defender, defenseCountInWindow, FightConstants.ELO.INACTIVE_DEFENDER);
	}

	/**
	 * Expected score of a player against an opponent, from 0 (sure to lose) to 1 (sure to win)
	 * @param playerRating The player rating
	 * @param opponentRating Their opponent rating
	 */
	static getExpectedScore(playerRating: number, opponentRating: number): number {
		return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / FightConstants.ELO.RATING_SCALE));
	}

	/**
	 * Calculate the new elo rating of a player
	 * @param playerRating The player rating
	 * @param opponentRating Their opponent rating
	 * @param gameResult The game result for the player
	 * @param kFactor The k factor of the player (see EloUtils.getKFactor)
	 */
	static calculateNewRating(playerRating: number, opponentRating: number, gameResult: EloGameResult, kFactor: number): number {
		const newElo = Math.round(playerRating + kFactor * (gameResult - EloUtils.getExpectedScore(playerRating, opponentRating)));
		return Math.max(newElo + Math.round((newElo - playerRating) * (1.49 - Math.tanh((playerRating - 502) / 140) / 2 - 0.87)), 0);
	}
}
