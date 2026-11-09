/** Ranked fights in which the AI defended the player against attackers of one class, over the last days. */
export type DefenseRecord = {
	attackerClassId: number;
	defenses: number;
	won: number;
};
