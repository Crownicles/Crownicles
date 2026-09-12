import { ValueAndMax } from "./ValueAndMax";

export type GuildMember = {
	id: number;
	name?: string;
	isSelf: boolean;
	rank: number;
	score: number;
	islandStatus: {
		isOnPveIsland: boolean; isOnBoat: boolean; isPveIslandAlly: boolean; cannotBeJoinedOnBoat: boolean;
	};
};
export type GuildData = {
	name: string;
	description?: string;
	chiefId: number;
	elderId: number | null;
	level: number;
	isMaxLevel: boolean;
	experience: ValueAndMax;
	rank: {
		unranked: boolean; rank: number; numberOfGuilds: number; score: number;
	};
	members: GuildMember[];
};
export type GuildCreationStatus = {
	foundGuild: boolean; guildNameIsAvailable?: boolean; guildNameIsAcceptable?: boolean; missingMoney?: number;
};
export type GuildDailyReward = {
	guildName: string;
	pet?: {
		typeId: number; isFemale: boolean;
	};
	money?: number;
	fullHeal?: boolean;
	heal?: number;
	alteration?: { healAmount?: number };
	personalXp?: number;
	guildXp?: number;
	guildPoints?: number;
	commonFood?: number;
	badge?: boolean;
	advanceTime?: number;
	superBadge?: boolean;
};
export type GuildCommandOutcome =
	| { type: "descriptionUpdated" }
	| {
		type: "descriptionInvalid"; min: number; max: number;
	}
	| { type: "notInGuild" }
	| { type: "forbidden" }
	| {
		type: "left"; guildName: string; isGuildDestroyed?: boolean; newChiefName?: string;
	}
	| {
		type: "created"; guildName: string;
	}
	| {
		type: "creationStatus"; status: GuildCreationStatus;
	}
	| { type: "cancelled" }
	| {
		type: "daily"; reward: GuildDailyReward;
	}
	| {
		type: "dailyCooldown"; totalTime: number; remainingTime: number;
	}
	| { type: "dailyIsland" };
