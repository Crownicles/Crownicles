import { FightConstants } from "../constants/FightConstants";

export type FinalPveBossId = typeof FightConstants.FINAL_BOSS_MONSTER_IDS[keyof typeof FightConstants.FINAL_BOSS_MONSTER_IDS];

type PveBossRecordBase = {
	monsterId: FinalPveBossId;
	monsterLevel: number;
	classId: number;
	turns: number;
	date: number;
};

export type PveBossRecordAction = {
	actionId: string;
	count: number;
};

export type PveBossPersonalRecord = PveBossRecordBase & {
	actions: PveBossRecordAction[];
};

export type PveBossLeaderboardEntry = PveBossRecordBase & {
	playerKeycloakId: string;
};

export type PveBossFightRecord = PveBossPersonalRecord & PveBossLeaderboardEntry;

/** A final island boss beaten above the best level the player's class had ever beaten it at. */
export type PveBossNewRecord = {
	monsterId: FinalPveBossId;
	monsterLevel: number;
	classId: number;

	/** Absent the first time this class beats the boss. */
	previousLevel?: number;
};
