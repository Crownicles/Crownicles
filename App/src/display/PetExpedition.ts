import {ExpeditionLocation, PetBasicInfo} from "ws-packets/src/objects/PetExpedition";
import {AppIcons} from "@/src/AppIcons";
import {i18n} from "@/src/translations/i18n";

export function expeditionPetName(pet: PetBasicInfo): string {
	return pet.petNickname || i18n.t(`models:pets.${pet.petTypeId}`, {context: pet.petSex === "f" ? "female" : "male"});
}

export function expeditionPetIcon(pet: PetBasicInfo): string {
	return AppIcons.getIcon(`pets.${pet.petTypeId}.${pet.petSex === "f" ? "emoteFemale" : "emoteMale"}`);
}

export function expeditionPetLabel(pet: PetBasicInfo): string {
	return i18n.t("app:pet.name", {icon: expeditionPetIcon(pet), name: expeditionPetName(pet)});
}

/** The destination's own name, without its landscape emoji. */
export function expeditionLocationTitle(location: ExpeditionLocation): string {
	const name = location.mapLocationId === undefined
		? i18n.t(`models:map_types.${location.locationType}.name`)
		: i18n.t(`commands:petExpedition.mapLocationExpeditions.${location.mapLocationId}`);
	return location.isDistantExpedition ? i18n.t("commands:petExpedition.distantExpeditionPrefix", {location: name}) : name;
}

export function expeditionLocationIcon(location: ExpeditionLocation): string {
	return AppIcons.getIcon(`expedition.locations.${location.locationType}`);
}

export function expeditionLocationName(location: ExpeditionLocation): string {
	return i18n.t("app:expedition.locationName", {icon: expeditionLocationIcon(location), name: expeditionLocationTitle(location)});
}

export function expeditionRisk(category: string): string {
	return i18n.t("app:expedition.locationName", {icon: AppIcons.getIcon(`expedition.risk.${category}`), name: i18n.t(`commands:petExpedition.riskCategories.${category}`)});
}

/** How much of the expedition has gone by; full once the pet is back. */
export function expeditionProgress(expedition: {startTime: number; endTime: number}, currentTime: number): number {
	const duration = expedition.endTime - expedition.startTime;
	if (duration <= 0) return 1;
	return Math.min(Math.max((currentTime - expedition.startTime) / duration, 0), 1);
}