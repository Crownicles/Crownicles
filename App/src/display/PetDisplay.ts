import {OwnedPet, PetSex} from "ws-packets/src/objects/OwnedPet";
import {i18n} from "@/src/translations/i18n";
import {AppIcons} from "@/src/AppIcons";

const RARITY_RANGE = {
	MIN: 0,
	MAX: 8
};

const MAX_LOVE_LEVEL = 5;

/**
 * i18next resolves the sex-dependent keys through a context, the same way the Discord client does.
 * @param sex
 */
function sexContext(sex: PetSex): string {
	return sex === "f" ? "female" : "male";
}

export function petIcon(pet: OwnedPet): string {
	return AppIcons.getIcon(`pets.${pet.typeId}.${pet.sex === "f" ? "emoteFemale" : "emoteMale"}`);
}

export function petTypeName(pet: OwnedPet): string {
	return i18n.t(`models:pets:${pet.typeId}`, { context: sexContext(pet.sex) });
}

export function petNickname(pet: OwnedPet): string {
	return pet.nickname ? pet.nickname : i18n.t("commands:pet.noNickname");
}

export function petRarity(pet: OwnedPet): string {
	return i18n.t(`items:rarities.${Math.max(RARITY_RANGE.MIN, Math.min(pet.rarity, RARITY_RANGE.MAX))}`);
}

export function petSex(pet: OwnedPet): string {
	// This key is the odd one out: it is suffixed with the short sex, not the long one
	return i18n.t("commands:pet.sexDisplay", { context: pet.sex });
}

export function petMood(pet: OwnedPet): string {
	return i18n.t(`commands:pet.loveLevels.${pet.loveLevel}`, { context: sexContext(pet.sex) });
}

export function petMoodRatio(pet: OwnedPet): number {
	return pet.loveLevel / MAX_LOVE_LEVEL;
}
