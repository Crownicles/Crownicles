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
