export interface GuildMember {
	id: number;
	keycloakId: string;
	rank: number;
	score: number;
	islandStatus: {
		isOnPveIsland: boolean;
		isOnBoat: boolean;
		isPveIslandAlly: boolean;
		cannotBeJoinedOnBoat: boolean;
	};

	/** Set while the member is on probation and cannot take pets out of the shelter. */
	probationEndsAt?: number;
}
