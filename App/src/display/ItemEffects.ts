import {ItemNature} from "ws-packets/src/objects/ItemNature";
import {ItemWithDetails} from "ws-packets/src/objects/ItemWithDetails";
import {SupportItem} from "ws-packets/src/objects/SupportItem";
import {i18n} from "@/src/translations/i18n";
import {formatNumber} from "@/src/display/Amounts";

const ITEM_TYPES_BY_CATEGORY = ["weapon", "armor", "potion", "object"] as const;

const MINUTES_PER_HOUR = 60;

export function itemTypeFromCategory(category: number): typeof ITEM_TYPES_BY_CATEGORY[number] | null {
	return ITEM_TYPES_BY_CATEGORY[category] ?? null;
}

export function isPotionCategory(category: number): boolean {
	return itemTypeFromCategory(category) === "potion";
}

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

/** Natures only a fight can use: such a potion cannot be drunk and such an object gives no daily bonus. */
const FIGHT_NATURES: ReadonlySet<ItemNature> = new Set([ItemNature.ATTACK, ItemNature.DEFENSE, ItemNature.SPEED]);

function isSupportItem(item: ItemWithDetails): item is SupportItem {
	return "nature" in item;
}

export function isDrinkable(item: ItemWithDetails): boolean {
	return isSupportItem(item) && !FIGHT_NATURES.has(item.nature);
}

export function givesDailyBonus(item: ItemWithDetails): boolean {
	return isSupportItem(item) && item.nature !== ItemNature.NONE && !FIGHT_NATURES.has(item.nature);
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
	if (!("nature" in item)) return i18n.t(`items:raritiesWithoutEmote.${item.rarity}`);
	const key = isPotionCategory(item.itemCategory) ? "potionsNaturesWithoutEmote" : "objectsNaturesWithoutEmote";
	return i18n.t(`items:${key}.${item.nature}`, {power: effectAmount(item.nature, item.power)});
}

/** The effect as Discord writes it, behind the emoji of its nature. */
export function consumableEffect(item: SupportItem): string {
	const key = isPotionCategory(item.itemCategory) ? "potionsNatures" : "objectsNatures";
	// These keys format the number themselves: a pre-formatted "1 250" would read as NaN.
	return i18n.t(`items:${key}.${item.nature}`, {power: item.nature === ItemNature.TIME_SPEEDUP ? formatDurationMinutes(item.power) : item.power});
}
