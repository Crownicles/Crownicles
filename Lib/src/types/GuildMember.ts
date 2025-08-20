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
}
