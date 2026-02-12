import {
	ItemCategory, itemCategoryToString, ItemConstants
} from "../../../Lib/src/constants/ItemConstants";
import { CrowniclesIcons } from "../../../Lib/src/CrowniclesIcons";
import i18n from "../translations/i18n";
import { Language } from "../../../Lib/src/Language";
import { ItemWithDetails } from "../../../Lib/src/types/ItemWithDetails";
import { Item } from "../../../Lib/src/types/Item";
import {
	SexTypeShort, StringConstants
} from "../../../Lib/src/constants/StringConstants";
import { OwnedPet } from "../../../Lib/src/types/OwnedPet";
import { PetFood } from "../../../Lib/src/types/PetFood";
import {
	StringUtils
} from "./StringUtils";
import { DiscordItemUtils } from "./DiscordItemUtils";
import { MainItemDetails } from "../../../Lib/src/types/MainItemDetails";
import { SupportItemDetails } from "../../../Lib/src/types/SupportItemDetails";
import { resolveKeycloakPlayerName } from "./KeycloakPlayerUtils";

export class DisplayUtils {
	/**
	 * Display the item name with its icon
	 * @param item
	 * @param language
	 */
	static getSimpleItemDisplay(item: Item, language: Language): string {
		switch (item.category) {
			case ItemCategory.WEAPON:
				return DisplayUtils.getSimpleWeaponDisplay(item.id, language);
			case ItemCategory.ARMOR:
				return DisplayUtils.getSimpleArmorDisplay(item.id, language);
			case ItemCategory.POTION:
				return DisplayUtils.getSimplePotionDisplay(item.id, language);
			case ItemCategory.OBJECT:
				return DisplayUtils.getSimpleObjectDisplay(item.id, language);
			default:
				return "Missing no";
		}
	}

	static getSimpleItemName(item: Item, lng: Language): string {
		return i18n.t(`models:${itemCategoryToString(item.category)}.${item.id}`, { lng });
	}

	static getItemIcon(item: Item): string {
		let emote;
		switch (item.category) {
			case ItemCategory.WEAPON:
				emote = CrowniclesIcons.weapons[item.id];
				break;
			case ItemCategory.ARMOR:
				emote = CrowniclesIcons.armors[item.id];
				break;
			case ItemCategory.POTION:
				emote = CrowniclesIcons.potions[item.id];
				break;
			case ItemCategory.OBJECT:
				emote = CrowniclesIcons.objects[item.id];
				break;
			default:
				return "Missing no";
		}

		return emote;
	}

	/**
	 * Display the item name with its icon
	 * @param weaponId
	 * @param lng
	 */
	static getSimpleWeaponDisplay(weaponId: number, lng: Language): string {
		return `${DisplayUtils.getItemIcon({
			category: ItemCategory.WEAPON,
			id: weaponId
		})} ${i18n.t(`models:weapons.${weaponId}`, { lng })}`;
	}

	/**
	 * Display the item name with its icon
	 * @param armorId
	 * @param lng
	 */
	static getSimpleArmorDisplay(armorId: number, lng: Language): string {
		return `${DisplayUtils.getItemIcon({
			category: ItemCategory.ARMOR,
			id: armorId
		})} ${i18n.t(`models:armors.${armorId}`, { lng })}`;
	}

	/**
	 * Display the potion name with its icon
	 * @param potionId
	 * @param lng
	 */
	static getSimplePotionDisplay(potionId: number, lng: Language): string {
		return `${DisplayUtils.getItemIcon({
			category: ItemCategory.POTION,
			id: potionId
		})} ${i18n.t(`models:potions.${potionId}`, { lng })}`;
	}

	/**
	 * Display the object name with its icon
	 * @param objectId
	 * @param lng
	 */
	static getSimpleObjectDisplay(objectId: number, lng: Language): string {
		return `${DisplayUtils.getItemIcon({
			category: ItemCategory.OBJECT,
			id: objectId
		})} ${i18n.t(`models:objects.${objectId}`, { lng })}`;
	}

	/**
	 * Display the item name with its icon and stats
	 * @param itemWithDetails
	 * @param language
	 */
	static getItemDisplayWithStats(itemWithDetails: ItemWithDetails, language: Language): string {
		switch (itemWithDetails.itemCategory) {
			case ItemCategory.WEAPON:
				return DiscordItemUtils.getWeaponField(itemWithDetails as MainItemDetails, language).value;
			case ItemCategory.ARMOR:
				return DiscordItemUtils.getArmorField(itemWithDetails as MainItemDetails, language).value;
			case ItemCategory.POTION:
				return DiscordItemUtils.getPotionField(itemWithDetails as SupportItemDetails, language).value;
			case ItemCategory.OBJECT:
				return DiscordItemUtils.getObjectField(itemWithDetails as SupportItemDetails, language).value;
			default:
				return "Missing no";
		}
	}

	/**
	 * Display the emote of a map location + its name
	 * @param mapType
	 * @param mapLocationId
	 * @param lng
	 */
	static getMapLocationDisplay(mapType: string, mapLocationId: number, lng: Language): string {
		return i18n.t("{emote:mapTypes.{{mapType}}} $t(models:map_locations.{{mapLocationId}}.name)", {
			lng,
			mapLocationId,
			mapType
		});
	}

	/**
	 * Display the icon of a pet
	 * @param petId
	 * @param sex
	 */
	static getPetIcon(petId: number, sex: SexTypeShort): string {
		return CrowniclesIcons.pets[petId][sex === StringConstants.SEX.FEMALE.short ? "emoteFemale" : "emoteMale"];
	}

	/**
	 * Get the name of an animal type linked to a pet in the specified language
	 * @param lng
	 * @param typeId
	 * @param sex
	 */
	static getPetTypeName(lng: Language, typeId: number, sex: SexTypeShort): string {
		const sexStringContext: string = sex === StringConstants.SEX.MALE.short ? StringConstants.SEX.MALE.long : StringConstants.SEX.FEMALE.long;
		return i18n.t(
			`models:pets:${typeId}`,
			{
				lng,
				context: sexStringContext
			}
		);
	}

	/**
	 * Display the emote of a pet + its name
	 * @param petId
	 * @param sex
	 * @param lng
	 */
	static getPetDisplay(petId: number, sex: SexTypeShort, lng: Language): string {
		const context = sex === StringConstants.SEX.FEMALE.short ? StringConstants.SEX.FEMALE.long : StringConstants.SEX.MALE.long;
		return i18n.t(`{emote:pets.{{petId}}.emote${context[0].toUpperCase() + context.slice(1)}} $t(models:pets.{{petId}})`, {
			lng,
			context,
			petId
		});
	}

	static getPetNicknameOrTypeName(nickname: string | null, typeId: number, sex: SexTypeShort, lng: Language): string {
		return nickname ? DisplayUtils.getPetDisplayNickname(lng, nickname) : DisplayUtils.getPetTypeName(lng, typeId, sex);
	}

	/**
	 * Display the pet's information as a single line with the pet's icon and name (nickname or type name)
	 * @param ownedPet
	 * @param lng
	 */
	static getOwnedPetInlineDisplay(ownedPet: OwnedPet, lng: Language): string {
		return `${DisplayUtils.getPetIcon(ownedPet.typeId, ownedPet.sex)} ${DisplayUtils.getPetNicknameOrTypeName(ownedPet.nickname, ownedPet.typeId, ownedPet.sex, lng)}`;
	}

	/**
	 * Display the nickname of a pet or a default message if it has no nickname
	 * @param lng
	 * @param nickname
	 */
	static getPetDisplayNickname(lng: Language, nickname: string): string {
		return nickname ? nickname : i18n.t("commands:pet.noNickname", { lng });
	}

	/**
	 * Display the item-style rarity entry of a pet (emoji + text)
	 * @param rarity
	 * @param lng
	 */
	static getPetRarityDisplay(rarity: number, lng: Language): string {
		const safeRarity = Math.max(ItemConstants.RARITY.BASIC, Math.min(rarity, ItemConstants.RARITY.MYTHICAL));
		return i18n.t(`items:rarities.${safeRarity}`, { lng });
	}

	/**
	 * Display the sex icon of a pet
	 * @param sex
	 * @param lng
	 */
	static getPetSexName(sex: SexTypeShort, lng: Language): string {
		return sex === "f" ? i18n.t("models:sex.female", { lng }) : i18n.t("models:sex.male", { lng });
	}

	/**
	 * Display the adjective corresponding to the love level of a pet
	 * @param loveLevel
	 * @param sex
	 * @param lng
	 * @param withIcon
	 */
	static getPetLoveLevelDisplay(loveLevel: number, sex: SexTypeShort, lng: Language, withIcon = true): string {
		const sexStringContext: string = sex === StringConstants.SEX.MALE.short ? StringConstants.SEX.MALE.long : StringConstants.SEX.FEMALE.long;
		const text = i18n.t(`commands:pet.loveLevels.${loveLevel}`, {
			context: sexStringContext as unknown,
			lng
		});

		if (withIcon) {
			return text;
		}

		return text.split(" ")[1];
	}

	/**
	 * Display the pet's information as a field with line breaks and values followed by colons (name, rarity, sex, love level)
	 * @param ownedPet
	 * @param lng
	 */
	static getOwnedPetFieldDisplay(ownedPet: OwnedPet, lng: Language): string {
		return i18n.t("commands:pet.petField", {
			lng,
			emote: DisplayUtils.getPetIcon(ownedPet.typeId, ownedPet.sex),
			typeName: DisplayUtils.getPetTypeName(lng, ownedPet.typeId, ownedPet.sex),
			nickname: DisplayUtils.getPetDisplayNickname(lng, ownedPet.nickname),
			rarity: DisplayUtils.getPetRarityDisplay(ownedPet.rarity, lng),
			sex: i18n.t("commands:pet.sexDisplay", {
				lng,
				context: ownedPet.sex
			}),
			loveLevel: DisplayUtils.getPetLoveLevelDisplay(ownedPet.loveLevel, ownedPet.sex, lng)
		});
	}

	/**
	 * Return the string of a class
	 * @param classId
	 * @param lng
	 * @param plural - If true, returns the plural form of the class
	 */
	static getClassDisplay(classId: number, lng: Language, plural = false): string {
		const format = plural ? "classPluralFormat" : "classFormat";
		return i18n.t(`models:${format}`, {
			lng,
			id: classId
		});
	}

	/**
	 * Return the string of food with its icon
	 * @param food
	 * @param count
	 * @param lng
	 * @param capitalizeFirstLetter
	 */
	static getFoodDisplay(food: PetFood, count: number, lng: Language, capitalizeFirstLetter: boolean): string {
		let name = i18n.t(`models:foods.${food}`, {
			lng,
			count
		});
		if (capitalizeFirstLetter) {
			name = StringUtils.capitalizeFirstLetter(name);
		}
		return `${CrowniclesIcons.foods[food]} ${name}`;
	}

	static async getEscapedUsername(keycloakId: string, lng: Language): Promise<string> {
		return await resolveKeycloakPlayerName(keycloakId, lng);
	}

	/**
	 * Format a number with thousands separators according to the language
	 * @param value
	 * @param lng
	 */
	static formatNumber(value: number, lng: Language): string {
		if (!Number.isFinite(value)) {
			return String(value);
		}
		return new Intl.NumberFormat(lng, { useGrouping: true }).format(value);
	}
}
