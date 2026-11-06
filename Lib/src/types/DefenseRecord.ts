/**
 * Ranked fights in which the AI defended a player against attackers of one class, over the last days
 */
export type DefenseRecordByAttackerClass = {
	attackerClassId: number;
	defenses: number;
	won: number;
};
