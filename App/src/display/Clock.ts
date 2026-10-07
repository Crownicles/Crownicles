import {i18n} from "@/src/translations/i18n";

/** The hour of the day a game moment falls on, the way the player's own clock shows it. */
export function clockTime(timestamp: number): string {
	return new Intl.DateTimeFormat(i18n.language, {timeStyle: "short"}).format(timestamp);
}
