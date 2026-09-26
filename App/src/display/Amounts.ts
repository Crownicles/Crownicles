import {AppIcons} from "@/src/AppIcons";
import {i18n} from "@/src/translations/i18n";

/**
 * Units the game prints right after a number, named after their entry in the shared icon set.
 */
export const AMOUNT_UNITS = {
	MONEY: "money",
	GEM: "gem",
	TOKEN: "token",
	GLORY: "glory"
} as const;

export type AmountUnit = typeof AMOUNT_UNITS[keyof typeof AMOUNT_UNITS];

/**
 * Groups digits the way the player's language does rather than the way the developer's does.
 */
export function formatNumber(value: number): string {
	return value.toLocaleString(i18n.language);
}

/** Keeps a gain explicitly signed, so it never reads like a loss at a glance. */
export function formatSignedNumber(value: number): string {
	return value > 0 ? `+${formatNumber(value)}` : formatNumber(value);
}

export function formatAmount(value: number, unit: AmountUnit): string {
	return `${formatNumber(value)} ${AppIcons.getIcon(`unitValues.${unit}`)}`;
}

export function formatMoney(value: number): string {
	return formatAmount(value, AMOUNT_UNITS.MONEY);
}

export function formatGlory(value: number): string {
	return formatAmount(value, AMOUNT_UNITS.GLORY);
}
