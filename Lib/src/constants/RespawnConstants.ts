export abstract class RespawnConstants {
	static readonly SCORE_REMOVAL_MULTIPLIER = 0.1;

	static getLostScore(score: number): number {
		return Math.round(score * RespawnConstants.SCORE_REMOVAL_MULTIPLIER);
	}
}
