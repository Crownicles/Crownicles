import {
	asDays, daysToSeconds
} from "../utils/TimeUtils";

export const AdventureHistoryConstants = {
	WINDOW_SECONDS: daysToSeconds(asDays(7)),
	PAGE_SIZE: 20,
	MAX_PAGE: 500
} as const;
