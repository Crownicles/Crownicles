import {
	asMinutes, Minute
} from "../types/TimeTypes";

export abstract class ReportConstants {
	static readonly TIME_LIMIT: Minute = asMinutes(1000);

	static readonly END_POSSIBILITY_ID = "end";
}
