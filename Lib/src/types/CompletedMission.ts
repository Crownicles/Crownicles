export enum MissionType {
	NORMAL = "sideMission",
	DAILY = "daily",
	CAMPAIGN = "campaign"
}

export interface CompletedMission extends BaseMission {
	pointsToWin: number;
	xpToWin: number;
	gemsToWin: number;
	moneyToWin: number;
	petRewardTypeId?: number;
}

export type BaseMission = {
	missionId: string;
	missionObjective: number;
	missionVariant: number;
	numberDone: number;
	saveBlob?: string;
	missionType: MissionType;
	expiresAt?: string;
	fightAction?: string;
	mapType?: string;
};
