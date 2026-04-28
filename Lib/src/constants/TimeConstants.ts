import {
	Millisecond, Second
} from "../types/TimeTypes";

export enum DAYS {
	MONDAY = 1,
	TUESDAY = 2,
	WEDNESDAY = 3,
	THURSDAY = 4,
	FRIDAY = 5,
	SATURDAY = 6,
	SUNDAY = 7,

	JS_SUNDAY_INDEX = 0
}

export abstract class TimeConstants {
	static readonly MS_TIME: {
		readonly MILLISECOND: Millisecond;
		readonly SECOND: Millisecond;
		readonly MINUTE: Millisecond;
		readonly HOUR: Millisecond;
		readonly DAY: Millisecond;
		readonly WEEK: Millisecond;
	} = {
		MILLISECOND: 1 as Millisecond,
		SECOND: 1000 as Millisecond,
		MINUTE: 60000 as Millisecond,
		HOUR: 3600000 as Millisecond,
		DAY: 86400000 as Millisecond,
		WEEK: 604800000 as Millisecond
	};

	static readonly S_TIME: {
		readonly SECOND: Second;
		readonly MINUTE: Second;
		readonly HOUR: Second;
		readonly DAY: Second;
		readonly WEEK: Second;
	} = {
		SECOND: 1 as Second,
		MINUTE: 60 as Second,
		HOUR: 3600 as Second,
		DAY: 86400 as Second,
		WEEK: 604800 as Second
	};

	static readonly HOURS_IN_DAY = 24;

	static readonly DAYS_IN_WEEK = 7;
}
