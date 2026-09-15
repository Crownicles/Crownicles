export const PLAYER_EFFECTS = { DEAD: "dead" } as const;

export const PLAYER_UTILITY_ERRORS = {
	ALREADY_ALIVE: "alreadyAlive",
	NO_PLAYER: "noPlayer",
	NOT_JAILED: "notJailed",
	SELF: "self",
	CANCELLED: "cancelled",
	NO_GUILD: "noGuild",
	TOO_MANY_RUNS: "tooManyRuns",
	NO_MEMBER_ON_BOAT: "noMemberOnBoat",
	NOT_TRAVELLING: "notTravelling",
	NO_ENERGY: "noEnergy",
	NO_GEMS: "noGems"
} as const;
export type PlayerUtilityError = typeof PLAYER_UTILITY_ERRORS[keyof typeof PLAYER_UTILITY_ERRORS];
export type PlayerUtilityOutcome =
	| {
		type: "respawn"; lostScore: number;
	}
	| {
		type: "unlocked"; playerName?: string;
	}
	| {
		type: "boat"; score: number;
	}
	| {
		type: "money"; money: number;
	}
	| {
		type: "error"; error: PlayerUtilityError;
	};
