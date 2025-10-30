import Player from "../../core/database/game/models/Player";
import { LogsReadRequests } from "../../core/database/logs/LogsReadRequests";
import { BigEvent } from "../BigEvent";
import { getWeekNumber } from "../../../../Lib/src/utils/TimeUtils";

const dateFunctions: {
	[Property in keyof DateFormat]: (date: Date) => number
} = {
	year: date => date.getFullYear(),
	month: date => date.getMonth() + 1, // Starts at 0
	day: date => date.getDate(),
	hour: date => date.getHours(),
	minute: date => date.getMinutes(),
	second: date => date.getSeconds()
};

function verifyTriggerDate(trigger: BigEventTrigger): boolean {
	// Don't do the following operations if no date is specified -> save CPU time
	if (!trigger.date) {
		return true;
	}

	const date = new Date();
	for (const [timeScale, timeRange] of Object.entries(trigger.date)) {
		const value = dateFunctions[timeScale as keyof DateFormat](date);
		if ((timeRange?.from ?? -1) > value || (timeRange?.to ?? 99999) < value) {
			return false;
		}
	}
	return true;
}

async function verifyOncePer(bigEvent: BigEvent, trigger: BigEventTrigger, player: Player): Promise<boolean> {
	if (!trigger.oncePer) {
		return true;
	}

	const lastDate = await LogsReadRequests.getLastEventDate(player.keycloakId, bigEvent.id);

	if (!lastDate) {
		return true;
	}

	const now = new Date();

	switch (trigger.oncePer) {
		case "year":
			return lastDate.getFullYear() !== now.getFullYear();
		case "month":
			return lastDate.getFullYear() !== now.getFullYear() || lastDate.getMonth() !== now.getMonth();
		case "week":
			return lastDate.getFullYear() !== now.getFullYear() || lastDate.getMonth() !== now.getMonth() || getWeekNumber(lastDate) !== getWeekNumber(now);
		case "day":
			return lastDate.getFullYear() !== now.getFullYear() || lastDate.getMonth() !== now.getMonth() || lastDate.getDate() !== now.getDate();
		default:
			return true;
	}
}

/**
 * Verify whether a big event trigger is verified
 * @param bigEvent The big event
 * @param mapId The map id
 * @param player The player
 * @param trigger The big event trigger object
 */
export async function verifyTrigger(bigEvent: BigEvent, trigger: BigEventTrigger, mapId: number, player: Player): Promise<boolean> {
	return (trigger.mapId ? mapId === trigger.mapId : true)
		&& (trigger.level ? player.level > trigger.level : true)
		&& verifyTriggerDate(trigger)
		&& (trigger.mapAttributes ? trigger.mapAttributes.includes(player.getDestination().attribute) : true)
		&& await verifyOncePer(bigEvent, trigger, player);
}

type DatePart = {
	from?: number;
	to?: number;
};

type DateFormat = {
	year?: DatePart;
	month?: DatePart;
	day?: DatePart;
	dayOfTheWeek?: DatePart;
	hour?: DatePart;
	minute?: DatePart;
	second?: DatePart;
};

/**
 * A big event trigger is a set of condition to trigger a big event (for instance, a map id, a minimum level etc...)
 */
export interface BigEventTrigger {
	mapId?: number;
	level?: number;
	date?: DateFormat;
	oncePer?: "year" | "month" | "week" | "day";
	mapAttributes?: string[];
}
