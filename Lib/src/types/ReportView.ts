import type {
	ReactionCollectorCityData, ReactionCollectorCityPacket
} from "../packets/interaction/ReactionCollectorCity";

export type ReportCityAction = {
	id: string;
	reaction: ReactionCollectorCityPacket["reactions"][number];
};

export type ReportCityView = {
	data: ReactionCollectorCityData;
	actions: ReportCityAction[];
};

export const REPORT_CITY_ACTION_RESULTS = {
	EXECUTED: "executed",
	STALE: "stale"
} as const;

export type ReportCityActionResult = typeof REPORT_CITY_ACTION_RESULTS[keyof typeof REPORT_CITY_ACTION_RESULTS];
