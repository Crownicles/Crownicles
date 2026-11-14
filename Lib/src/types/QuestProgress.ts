import { QuestId } from "../constants/QuestConstants";

/**
 * Progress of a player in a quest
 */
export type QuestProgress = {
	questId: QuestId;

	/** Number of steps completed, between 0 and the step count of the quest */
	stepsDone: number;
};
