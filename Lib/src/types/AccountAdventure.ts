/** Where an account stands in the game, so a player choosing between two accounts recognises each. */
export type AccountAdventure = {
	keycloakId: string;
	level: number;
	score: number;
	classId: number;
};
