import { Language } from "../../../Lib/src/Language";
import i18n from "../translations/i18n";
import {
	MainItemDisplayPacket,
	SupportItemDisplayPacket
} from "../../../Lib/src/packets/commands/CommandInventoryPacket";
import { EmbedField } from "discord.js";
import {
	itemCategoryToString, ItemNature
} from "../../../Lib/src/constants/ItemConstants";
import { minutesDisplay } from "../../../Lib/src/utils/TimeUtils";
import { StatValues } from "../../../Lib/src/types/StatValues";
import { EmoteUtils } from "./EmoteUtils";
import { DisplayUtils } from "./DisplayUtils";


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
		return DiscordItemUtils.getClassicItemField(
			"potions",
			DisplayUtils.getItemIcon({
				id: displayPacket.id, category: displayPacket.itemCategory
			}),
			i18n.t(`items:potionsNatures.${displayPacket.nature}`, {
				lng,
				power: displayPacket.nature === ItemNature.TIME_SPEEDUP ? minutesDisplay(displayPacket.power, lng) : displayPacket.power
			}),
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
			i18n.t(`items:objectsNatures.${displayPacket.nature}`, {
				lng,
				power: displayPacket.nature === ItemNature.TIME_SPEEDUP
					? minutesDisplay(displayPacket.power, lng)
					: [
						ItemNature.SPEED,
						ItemNature.DEFENSE,
						ItemNature.ATTACK
					].includes(displayPacket.nature) && displayPacket.maxPower < displayPacket.power
						? i18n.t("items:nerfDisplay", {
							lng,
							old: displayPacket.power,
							max: displayPacket.maxPower
						})
						: displayPacket.power
			}),
			displayPacket,
			lng
		);
	}

	static getShortDisplay(item: MainItemDisplayPacket | SupportItemDisplayPacket, lng: Language): string {
		return i18n.t("items:nameDisplay", {
			lng,
			itemId: item.id,
			itemCategory: `${itemCategoryToString(item.itemCategory)}`
		});
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
			emote: EmoteUtils.translateEmojiToDiscord(emote),
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
