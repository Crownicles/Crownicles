import { Language } from "../../../Lib/src/Language";
import i18n from "../translations/i18n";
import { EmbedField } from "discord.js";
import {
	FightItemNatures, itemCategoryToString, ItemNature
} from "../../../Lib/src/constants/ItemConstants";
import { minutesDisplay } from "../../../Lib/src/utils/TimeUtils";
import { DisplayUtils } from "./DisplayUtils";
import { ItemEnchantment } from "../../../Lib/src/types/ItemEnchantment";
import { CrowniclesIcons } from "../../../Lib/src/CrowniclesIcons";
import { MainItemDetails } from "../../../Lib/src/types/MainItemDetails";
import { SupportItemDetails } from "../../../Lib/src/types/SupportItemDetails";
import { ItemWithDetails } from "../../../Lib/src/types/ItemWithDetails";

type ValueStatParam = {
	baseValue: number;
	upgradeValue: number;
	maxValue: number;
};

export class DiscordItemUtils {
	/**
	 * Get a stat value of an item into its string form
	 * @param lng
	 * @param values
	 * @param value
	 * @param valueType
	 */
	static getStringValueFor(lng: Language, values: string[], value: ValueStatParam, valueType: "attack" | "defense" | "speed"): void {
		if (value.baseValue !== 0) {
			const totalValue = value.baseValue + value.upgradeValue;
			let display = i18n.t("items:stat", {
				lng,
				value: totalValue
			});

			if (totalValue > value.maxValue) {
				display = i18n.t("items:statNerf", {
					lng,
					oldDisplay: display,
					max: value.maxValue
				});
			}

			values.push(`${CrowniclesIcons.unitValues[valueType]} ${display}`);
		}
	}

	/**
	 * Get the string for the stats of the main item
	 * @param attack
	 * @param defense
	 * @param speed
	 * @param language
	 */
	static getValues(attack: ValueStatParam, defense: ValueStatParam, speed: ValueStatParam, language: Language): string {
		const values: string[] = [];
		DiscordItemUtils.getStringValueFor(language, values, attack, "attack");
		DiscordItemUtils.getStringValueFor(language, values, defense, "defense");
		DiscordItemUtils.getStringValueFor(language, values, speed, "speed");
		return values.join(" ");
	}

	static getWeaponField(displayPacket: MainItemDetails, lng: Language): EmbedField {
		return DiscordItemUtils.getClassicItemField(
			"weapons",
			DisplayUtils.getItemIcon({
				id: displayPacket.id, category: displayPacket.itemCategory
			}),
			DiscordItemUtils.getValues(displayPacket.attack, displayPacket.defense, displayPacket.speed, lng),
			displayPacket,
			lng
		);
	}

	static getArmorField(displayPacket: MainItemDetails, lng: Language): EmbedField {
		return DiscordItemUtils.getClassicItemField(
			"armors",
			DisplayUtils.getItemIcon({
				id: displayPacket.id, category: displayPacket.itemCategory
			}),
			DiscordItemUtils.getValues(displayPacket.attack, displayPacket.defense, displayPacket.speed, lng),
			displayPacket,
			lng
		);
	}

	static getPotionField(displayPacket: SupportItemDetails, lng: Language): EmbedField {
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

	static getObjectField(displayPacket: SupportItemDetails, lng: Language): EmbedField {
		return DiscordItemUtils.getClassicItemField(
			"objects",
			DisplayUtils.getItemIcon({
				id: displayPacket.id, category: displayPacket.itemCategory
			}),
			DiscordItemUtils.getObjectNatureDisplay(displayPacket.nature, displayPacket.power, displayPacket.maxPower, lng),
			displayPacket as unknown as ItemWithDetails,
			lng
		);
	}

	static getObjectNatureDisplay(nature: ItemNature, power: number, maxPower: number, lng: Language): string {
		return i18n.t(`items:objectsNatures.${nature}`, {
			lng,
			power: nature === ItemNature.TIME_SPEEDUP
				? minutesDisplay(power, lng)
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
				? minutesDisplay(power, lng)
				: power
		});
	}

	static getShortDisplay(item: ItemWithDetails, lng: Language): string {
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
	static getFielder(itemCategory: number): ((displayPacket: MainItemDetails, lng: Language) => EmbedField) | ((displayPacket: SupportItemDetails, lng: Language) => EmbedField) {
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

	private static getClassicItemI18nKey(model: "weapons" | "armors" | "potions" | "objects", displayPacket: ItemWithDetails): string {
		if (model === "weapons" || model === "armors") {
			const mainPacket = displayPacket as unknown as MainItemDetails;
			if (mainPacket.itemLevel > 0) {
				if (mainPacket.itemEnchantmentId) {
					return "items:mainItemsFieldUpgradeEnchant";
				}

				return "items:mainItemsFieldUpgrade";
			}
			else if (mainPacket.itemEnchantmentId) {
				return "items:mainItemsFieldNoUpgradeEnchant";
			}

			return "items:mainItemsFieldNoUpgradeNoEnchant";
		}

		return "items:supportItemsField";
	}

	private static getClassicItemField(
		model: "weapons" | "armors" | "potions" | "objects",
		emote: string,
		values: string,
		displayPacket: ItemWithDetails,
		lng: Language
	): EmbedField {
		const mainPacket = displayPacket as unknown as MainItemDetails;
		const enchantment = mainPacket.itemEnchantmentId ? ItemEnchantment.getById(mainPacket.itemEnchantmentId) : null;
		const itemField: string = i18n.t(DiscordItemUtils.getClassicItemI18nKey(model, displayPacket), {
			lng,
			name: i18n.t(`models:${model}.${displayPacket.id}`, {
				lng
			}),
			emote,
			rarity: i18n.t(`items:rarities.${displayPacket.rarity}`, { lng }),
			values,
			level: mainPacket.itemLevel ?? 0,
			enchant: enchantment ? i18n.t(`items:enchantments.${enchantment.id}`, { lng }) : undefined,
			enchantEmote: enchantment ? enchantment.kind.type.emoji : undefined
		});
		return {
			name: i18n.t(`items:${model}FieldName`, { lng }),
			value: displayPacket.id === 0 ? itemField.split("|")[0] : itemField,
			inline: false
		};
	}
}
