import Player from "../database/game/models/Player";
import { FightConstants } from "../../../../Lib/src/constants/FightConstants";
import { EloGameResult } from "../../../../Lib/src/types/EloGameResult";
import { LeagueInfoConstants } from "../../../../Lib/src/constants/LeagueInfoConstants";

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
	 * Get the k-factor for an attacker, boosted when the attacker is returning from inactivity.
	 * This is a custom Crownicles balancing rule to help stale attacker ratings converge faster.
	 * The boost is based on how many ranked fights the player has initiated in the last
	 * ATTACK_COUNT_WINDOW_WEEKS weeks: fewer attacks means a higher multiplier.
	 * @param attacker
	 * @param attackCountInWindow - Number of ranked fights initiated in the last ATTACK_COUNT_WINDOW_WEEKS weeks
	 */
	static getAttackerKFactor(attacker: Player, attackCountInWindow: number): number {
		const baseFactor = EloUtils.getKFactor(attacker);
		const attackBasedCountdown = Math.max(0, FightConstants.ELO.INACTIVE_ATTACKER_ATTACK_COUNT_THRESHOLD - attackCountInWindow);
		if (attackBasedCountdown >= FightConstants.ELO.INACTIVE_ATTACKER_FIGHT_COUNTDOWN_THRESHOLD
			&& attacker.getLeague().id < LeagueInfoConstants.ROYAL_LEAGUE_ID) {
			const multiplier = Math.min(
				attackBasedCountdown - 1,
				FightConstants.ELO.INACTIVE_ATTACKER_K_FACTOR_MAX_MULTIPLIER
			);
			return baseFactor * multiplier;
		}
		return baseFactor;
	}

	/**
	 * Calculate the new elo rating of a player
	 * @param playerRating The player rating
	 * @param opponentRating Their opponent rating
	 * @param gameResult The game result for the player
	 * @param kFactor The k factor of the player (see EloUtils.getKFactor)
	 */
	static calculateNewRating(playerRating: number, opponentRating: number, gameResult: EloGameResult, kFactor: number): number {
		const newElo = Math.round(playerRating + kFactor * (gameResult - 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400))));
		return Math.max(newElo + Math.round((newElo - playerRating) * (1.49 - Math.tanh((playerRating - 502) / 140) / 2 - 0.87)), 0);
	}
}
