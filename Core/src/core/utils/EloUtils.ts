import Player from "../database/game/models/Player";
import { FightConstants } from "../../../../Lib/src/constants/FightConstants";
import { EloGameResult } from "../../../../Lib/src/types/EloGameResult";

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
