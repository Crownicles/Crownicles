import {
	asMinutes, Minute
} from "../types/TimeTypes";

export abstract class ReportConstants {
	static readonly TIME_LIMIT: Minute = asMinutes(1000);

	static readonly END_POSSIBILITY_ID = "end";

	/**
	 * Id of the very first big event, used as the tutorial entry point.
	 * The "end" possibility on this event is handled as a no-op acknowledge.
	 */
	static readonly FIRST_BIG_EVENT_ID = 0;

	/**
	 * Base payload for a "no reward" big event result packet.
	 * Spread alongside the `eventId` / `possibilityId` of the current choice
	 * to acknowledge a possibility without applying any outcome.
	 */
	static readonly EMPTY_BIG_EVENT_RESULT = {
		outcomeId: "0",
		oneshot: false,
		money: 0,
		energy: 0,
		gems: 0,
		experience: 0,
		health: 0,
		score: 0
	} as const;
}
