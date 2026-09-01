export const TournamentCategories = {
	LEVEL_50: "level50",
	LEVEL_100: "level100"
} as const;

export type TournamentCategory = typeof TournamentCategories[keyof typeof TournamentCategories];

export const TournamentStatuses = {
	REGISTRATION: "registration",
	COMBAT: "combat",
	PAUSED: "paused",
	COMPLETED: "completed",
	CANCELLED: "cancelled"
} as const;

export type TournamentStatus = typeof TournamentStatuses[keyof typeof TournamentStatuses];

export const TournamentNotificationEvents = {
	STARTED: "started",
	ENDING: "ending",
	ENDED: "ended"
} as const;

export type TournamentNotificationEvent = typeof TournamentNotificationEvents[keyof typeof TournamentNotificationEvents];

export type TournamentTopEntry = {
	playerKeycloakId: string;
	rank: number;
	category: TournamentCategory;
	attackGloryPoints: number;
	defenseGloryPoints: number;
	totalGloryPoints: number;
	effectiveLevel: number;
};

export type TournamentTopCategory = {
	category: TournamentCategory;
	totalParticipants: number;
	yourRank?: number;
	elements: TournamentTopEntry[];
};
