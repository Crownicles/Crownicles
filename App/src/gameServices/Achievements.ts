import type {FightEnd} from "ws-packets/src/objects/Fight";

export const GAME_ACHIEVEMENTS = {
	PVP_FIGHT_COMPLETED: "pvp_fight_completed"
} as const;

export type GameAchievementId = typeof GAME_ACHIEVEMENTS[keyof typeof GAME_ACHIEVEMENTS];
export const ACHIEVEMENT_COMPLETION_PERCENT = 100;

export function achievementsForFightEnd(result: FightEnd): GameAchievementId[] {
	if (result.winner.monsterId || result.loser.monsterId) return [];
	if (result.winner.isSelf === result.loser.isSelf) return [];
	return [GAME_ACHIEVEMENTS.PVP_FIGHT_COMPLETED];
}