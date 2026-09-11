export const MISSION_TYPES = {
	NORMAL: "sideMission",
	DAILY: "daily",
	CAMPAIGN: "campaign"
} as const;

export type MissionType = typeof MISSION_TYPES[keyof typeof MISSION_TYPES];

export const MISSION_VARIANTS = {
	TRAVEL: "fromPlaceToPlace",
	CLASS_TIER: "chooseClassTier",
	EXPEDITION_RISK: "dangerousExpedition",
	EXPEDITION_DURATION: "longExpedition",
	TRAVEL_DURATION: "travelHours",
	FIGHT_ATTACKS: "fightAttacks",
	FINISH_WITH_ATTACK: "finishWithAttack"
} as const;

export type MissionTravel = {
	fromMap: number;
	toMap: number;
	time: number;
	orderMatter: boolean;
	progress?: {
		startTimestamp: number;
		startMap: number;
	};
};

export type Mission = {
	missionId: string;
	missionObjective: number;
	missionVariant: number;
	numberDone: number;
	missionType: MissionType;
	expiresAt?: string;
	fightAction?: string;
	mapType?: string;
	travel?: MissionTravel;
	riskCategory?: string;
};

export type DailyMissionStatus = {
	completed: boolean;
	resetsAt: number;
};
