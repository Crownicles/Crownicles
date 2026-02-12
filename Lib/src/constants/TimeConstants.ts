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
	static readonly MS_TIME = {
		MILLISECOND: 1,
		SECOND: 1000,
		MINUTE: 60000,
		HOUR: 3600000,
		DAY: 86400000
	};

	static readonly S_TIME = {
		SECOND: 1,
		MINUTE: 60,
		HOUR: 3600,
		DAY: 86400,
		WEEK: 604800
	} as const;

	static readonly HOURS_IN_DAY = 24;

	static readonly DAYS_IN_WEEK = 7;
}
