import {ItemNature} from "ws-packets/src/objects/ItemNature";
import {ItemWithDetails} from "ws-packets/src/objects/ItemWithDetails";
import {i18n} from "@/src/translations/i18n";
import {formatNumber} from "@/src/display/Amounts";

const MINUTES_PER_HOUR = 60;

/** The game emoji each effect is counted in; an item without effect has none. */
const NATURE_UNITS: Partial<Record<ItemNature, string>> = {
	[ItemNature.HEALTH]: "health",
	[ItemNature.SPEED]: "speed",
	[ItemNature.ATTACK]: "attack",
	[ItemNature.DEFENSE]: "defense",
	[ItemNature.TIME_SPEEDUP]: "timeGain",
	[ItemNature.MONEY]: "money",
	[ItemNature.ENERGY]: "energy"
};

export function natureUnit(nature: ItemNature): string | undefined {
	return NATURE_UNITS[nature];
}

export function formatDurationMinutes(totalMinutes: number): string {
	const bounded = Math.max(0, Math.ceil(totalMinutes));
	const hours = Math.floor(bounded / MINUTES_PER_HOUR);
	const minutes = bounded % MINUTES_PER_HOUR;
	if (hours === 0) return i18n.t("app:adventure.duration.minutes", {count: bounded});
	return minutes === 0
		? i18n.t("app:adventure.duration.hours", {count: hours})
		: i18n.t("app:adventure.duration.hoursMinutes", {hours, minutes});
}

/** The power of an effect as a bare amount: a duration for time, a number otherwise. */
export function effectAmount(nature: ItemNature, value: number): string {
	return nature === ItemNature.TIME_SPEEDUP ? formatDurationMinutes(value) : formatNumber(value);
}

export function itemEffect(nature: ItemNature, value: number): string {
	return i18n.t(`items:potionsNaturesWithoutEmote.${nature}`, {power: effectAmount(nature, value)});
}

export function consumableDescription(item: ItemWithDetails): string {
	return "nature" in item ? itemEffect(item.nature, item.power) : i18n.t(`items:raritiesWithoutEmote.${item.rarity}`);
}
