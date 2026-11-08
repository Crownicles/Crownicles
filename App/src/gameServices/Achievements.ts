import type {
	FightEnd, FightParticipant
} from "ws-packets/src/objects/Fight";

export const GAME_ACHIEVEMENTS = {
	PVP_FIGHT_COMPLETED: "pvp_fight_completed"
} as const;

export type GameAchievementId = typeof GAME_ACHIEVEMENTS[keyof typeof GAME_ACHIEVEMENTS];
export const ACHIEVEMENT_COMPLETION_PERCENT = 100;

/** A monster or a king's guard: a fight against one is no fight between players. */
function isNonPlayer(fighter: FightParticipant): boolean {
	return Boolean(fighter.monsterId) || Boolean(fighter.isKingGuard);
}

export function achievementsForFightEnd(result: FightEnd): GameAchievementId[] {
	if ([result.winner, result.loser].some(isNonPlayer)) {
		return [];
	}
	if (result.winner.isSelf === result.loser.isSelf) {
		return [];
	}
	return [GAME_ACHIEVEMENTS.PVP_FIGHT_COMPLETED];
}
