import {
	asHours, Hour
} from "../types/TimeTypes";

export abstract class DailyConstants {
	static readonly TIME_BETWEEN_DAILIES: Hour = asHours(22);
}
