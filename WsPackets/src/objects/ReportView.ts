import {
	ReactionCollectorData, ReactionCollectorReaction
} from "../fromServer/collectors";

export type ReportCityAction = {
	id: string;
	reaction: ReactionCollectorReaction;
};

export type ReportCityView = {
	data: ReactionCollectorData;
	actions: ReportCityAction[];
};

export const REPORT_CITY_ACTION_RESULTS = {
	EXECUTED: "executed",
	STALE: "stale"
} as const;

export type ReportCityActionResult = typeof REPORT_CITY_ACTION_RESULTS[keyof typeof REPORT_CITY_ACTION_RESULTS];
