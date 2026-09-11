import {ItemNature} from "ws-packets/src/objects/ItemNature";
import {ItemWithDetails} from "ws-packets/src/objects/ItemWithDetails";
import {i18n} from "@/src/translations/i18n";
import {formatNumber} from "@/src/display/Amounts";

const MINUTES_PER_HOUR = 60;

export function formatDurationMinutes(totalMinutes: number): string {
	const bounded = Math.max(0, Math.ceil(totalMinutes));
	const hours = Math.floor(bounded / MINUTES_PER_HOUR);
	return hours > 0
		? i18n.t("app:adventure.duration.hoursMinutes", {hours, minutes: bounded % MINUTES_PER_HOUR})
		: i18n.t("app:adventure.duration.minutes", {count: bounded});
}

export function itemEffect(nature: ItemNature, value: number): string {
	const power = nature === ItemNature.TIME_SPEEDUP ? formatDurationMinutes(value) : formatNumber(value);
	return i18n.t(`items:potionsNaturesWithoutEmote.${nature}`, {power});
}

export function consumableDescription(item: ItemWithDetails): string {
	return "nature" in item ? itemEffect(item.nature, item.power) : i18n.t(`items:raritiesWithoutEmote.${item.rarity}`);
}
