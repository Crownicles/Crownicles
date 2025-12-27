import { Language } from "../../../Lib/src/Language";
import i18n from "../translations/i18n";
import {
	MainItemDisplayPacket,
	SupportItemDisplayPacket
} from "../../../Lib/src/packets/commands/CommandInventoryPacket";
import { EmbedField } from "discord.js";
import {
	FightItemNatures, itemCategoryToString, ItemNature
} from "../../../Lib/src/constants/ItemConstants";
import { StatValues } from "../../../Lib/src/types/StatValues";
import {
	DisplayUtils, formatPotionUsagesPrefix
} from "./DisplayUtils";


type Value = {
	maxValue: number;
	value: number;
	typeValue: "attack" | "defense" | "speed";
};

export class DiscordItemUtils {
	/**
	 * Get a stat value of an item into its string form
	 * @param lng
	 * @param values
	 * @param value
	 */
	static getStringValueFor(lng: Language, values: string[], value: Value): void {
		if (value.value !== 0) {
			values.push(i18n.t(`items:${value.typeValue}`, {
				lng,
				value: (value.maxValue ?? Infinity) >= value.value
					? value.value
					: i18n.t("items:nerfDisplay", {
						lng,
						old: value.value,
						max: value.maxValue
					})
			}));
		}
	}

	/**
	 * Get the string for the stats of the main item
	 * @param attack
	 * @param defense
	 * @param speed
	 * @param language
	 * @param maxStatsValue
	 */
	static getValues(attack: number, defense: number, speed: number, language: Language, maxStatsValue: StatValues | null = null): string {
		if (!maxStatsValue) {
			maxStatsValue = {
				attack: Infinity,
				defense: Infinity,
				speed: Infinity
			};
		}
		const values: string[] = [];
		DiscordItemUtils.getStringValueFor(language, values, {
			value: attack,
			maxValue: maxStatsValue.attack,
			typeValue: "attack"
		});
		DiscordItemUtils.getStringValueFor(language, values, {
			value: defense,
			maxValue: maxStatsValue.defense,
			typeValue: "defense"
		});
		DiscordItemUtils.getStringValueFor(language, values, {
			value: speed,
			maxValue: maxStatsValue.speed,
			typeValue: "speed"
		});
		return values.join(" ");
	}

	static getWeaponField(displayPacket: MainItemDisplayPacket, lng: Language): EmbedField {
		return DiscordItemUtils.getClassicItemField(
			"weapons",
			DisplayUtils.getItemIcon({
				id: displayPacket.id, category: displayPacket.itemCategory
			}),
			DiscordItemUtils.getValues(
				displayPacket.attack.value,
				displayPacket.defense.value,
				displayPacket.speed.value,
				lng,
				{
					attack: displayPacket.attack.maxValue,
					defense: displayPacket.defense.maxValue,
					speed: displayPacket.speed.maxValue
				}
			),
			displayPacket,
			lng
		);
	}

	static getArmorField(displayPacket: MainItemDisplayPacket, lng: Language): EmbedField {
		return DiscordItemUtils.getClassicItemField(
			"armors",
			DisplayUtils.getItemIcon({
				id: displayPacket.id, category: displayPacket.itemCategory
			}),
			DiscordItemUtils.getValues(
				displayPacket.attack.value,
				displayPacket.defense.value,
				displayPacket.speed.value,
				lng,
				{
					attack: displayPacket.attack.maxValue,
					defense: displayPacket.defense.maxValue,
					speed: displayPacket.speed.maxValue
				}
			),
			displayPacket,
			lng
		);
	}

	static getPotionField(displayPacket: SupportItemDisplayPacket, lng: Language): EmbedField {
		const natureValue = i18n.t(`items:potionsNatures.${displayPacket.nature}`, {
			lng,
			power: displayPacket.nature === ItemNature.TIME_SPEEDUP ? i18n.formatDuration(displayPacket.power, lng) : displayPacket.power
		});
		const usagesPrefix = formatPotionUsagesPrefix(displayPacket.usages, displayPacket.maxUsages);
		const value = `${usagesPrefix}${natureValue}`;
		return DiscordItemUtils.getClassicItemField(
			"potions",
			DisplayUtils.getItemIcon({
				id: displayPacket.id, category: displayPacket.itemCategory
			}),
			value,
			displayPacket,
			lng
		);
	}

	static getObjectField(displayPacket: SupportItemDisplayPacket, lng: Language): EmbedField {
		return DiscordItemUtils.getClassicItemField(
			"objects",
			DisplayUtils.getItemIcon({
				id: displayPacket.id, category: displayPacket.itemCategory
			}),
			DiscordItemUtils.getObjectNatureDisplay(displayPacket.nature, displayPacket.power, displayPacket.maxPower, lng),
			displayPacket,
			lng
		);
	}

	static getObjectNatureDisplay(nature: ItemNature, power: number, maxPower: number, lng: Language): string {
		return i18n.t(`items:objectsNatures.${nature}`, {
			lng,
			power: nature === ItemNature.TIME_SPEEDUP
				? i18n.formatDuration(power, lng)
				: FightItemNatures.includes(nature) && maxPower < power
					? i18n.t("items:nerfDisplay", {
						lng,
						old: power,
						max: maxPower
					})
					: power
		});
	}

	static getPotionNatureDisplay(nature: ItemNature, power: number, lng: Language): string {
		return i18n.t(`items:potionsNatures.${nature}`, {
			lng,
			power: nature === ItemNature.TIME_SPEEDUP
				? i18n.formatDuration(power, lng)
				: power
		});
	}

	static getShortDisplay(item: MainItemDisplayPacket | SupportItemDisplayPacket, lng: Language): string {
		return i18n.t("items:nameDisplay", {
			lng,
			itemId: item.id,
			itemCategory: `${itemCategoryToString(item.itemCategory)}`
		});
	}

	/**
	 * Get the fielder for the item category
	 * @param itemCategory
	 */
	static getFielder(itemCategory: number): ((displayPacket: MainItemDisplayPacket, lng: Language) => EmbedField) | ((displayPacket: SupportItemDisplayPacket, lng: Language) => EmbedField) {
		switch (itemCategory) {
			case 0:
				return DiscordItemUtils.getWeaponField;
			case 1:
				return DiscordItemUtils.getArmorField;
			case 2:
				return DiscordItemUtils.getPotionField;
			default:
				return DiscordItemUtils.getObjectField;
		}
	}

	private static getClassicItemField(
		model: "weapons" | "armors" | "potions" | "objects",
		emote: string,
		values: string,
		displayPacket: MainItemDisplayPacket | SupportItemDisplayPacket,
		lng: Language
	): EmbedField {
		const itemField: string = i18n.t("items:itemsField", {
			lng,
			name: i18n.t(`models:${model}.${displayPacket.id}`, {
				lng
			}),
			emote,
			rarity: i18n.t(`items:rarities.${displayPacket.rarity}`, { lng }),
			values
		});
		return {
			name: i18n.t(`items:${model}FieldName`, { lng }),
			value: displayPacket.id === 0 ? itemField.split("|")[0] : itemField,
			inline: false
		};
	}
}
