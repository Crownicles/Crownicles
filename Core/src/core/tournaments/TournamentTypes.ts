import type { TournamentCategory } from "../../../../Lib/src/types/Tournament";

export type TournamentCommandAccess = "none" | "registration" | "participant" | "fight";

export type TournamentFightContext = {
	tournamentId: number;
	attackerParticipantId: number;
	defenderParticipantId: number;
	category: TournamentCategory;
};
