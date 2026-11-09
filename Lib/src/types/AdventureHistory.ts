import { Second } from "./TimeTypes";

export type AdventureHistoryEvent = {
	date: Second;
	eventId: number;
	possibilityId: string;
	outcomeId: string;

	/** Absent when no travel was logged before the event. */
	mapId?: number;
};

export type AdventureHistoryPage = {
	entries: AdventureHistoryEvent[];
	until: Second;
	nextPage?: number;
};
