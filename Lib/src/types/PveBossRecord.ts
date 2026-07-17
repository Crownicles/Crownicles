import { FightConstants } from "../constants/FightConstants";

export type FinalPveBossId = typeof FightConstants.FINAL_BOSS_MONSTER_IDS[keyof typeof FightConstants.FINAL_BOSS_MONSTER_IDS];

type PveBossRecordBase = {
	monsterId: FinalPveBossId;
	monsterLevel: number;
	classId: number;
	turns: number;
	date: number;
};

export type PveBossFightRecord = PveBossRecordBase & {
	playerKeycloakId: string;
	actions: {
		actionId: string;
		count: number;
	}[];
};

export type PveBossPersonalRecord = Omit<PveBossFightRecord, "playerKeycloakId">;

export type PveBossLeaderboardEntry = PveBossRecordBase & {
	playerKeycloakId: string;
};
