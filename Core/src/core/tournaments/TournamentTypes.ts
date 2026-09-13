import type { TournamentCategory } from "../../../../Lib/src/types/Tournament";

export type TournamentCommandAccess = "none" | "registration" | "participant" | "fight" | "status";

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
