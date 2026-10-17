import type { TournamentCategory } from "../../../../Lib/src/types/Tournament";

export type TournamentCommandAccess = "none" | "fight" | "status" | "bypass";

export const TournamentAccessResults = {
	DENIED: "denied",
	ALLOWED: "allowed",

	// Tournament fights happen outside of the world: location and effect requirements no longer apply
	TOURNAMENT_FIGHT: "tournamentFight"
} as const;

export type TournamentAccessResult = typeof TournamentAccessResults[keyof typeof TournamentAccessResults];

export type TournamentFightContext = {
	tournamentId: number;
	attackerParticipantId: number;
	defenderParticipantId: number;
	category: TournamentCategory;
};

export type TournamentRewardRank = {
	rank: number;
	categoryParticipantCount: number;
};

export type TournamentRewardAmounts = {
	experience: number;
	money: number;
	itemCount: number;
};
