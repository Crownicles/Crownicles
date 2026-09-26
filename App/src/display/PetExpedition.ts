import {ExpeditionLocation, PetBasicInfo} from "ws-packets/src/objects/PetExpedition";
import {AppIcons} from "@/src/AppIcons";
import {i18n} from "@/src/translations/i18n";

export function expeditionPetName(pet: PetBasicInfo): string {
	return pet.petNickname || i18n.t(`models:pets.${pet.petTypeId}`, {context: pet.petSex === "f" ? "female" : "male"});
}

export function expeditionPetLabel(pet: PetBasicInfo): string {
	return i18n.t("app:pet.name", {icon: AppIcons.getIcon(`pets.${pet.petTypeId}.${pet.petSex === "f" ? "emoteFemale" : "emoteMale"}`), name: expeditionPetName(pet)});
}

export function expeditionLocationName(location: ExpeditionLocation): string {
	const name = location.mapLocationId === undefined
		? i18n.t(`models:map_types.${location.locationType}.name`)
		: i18n.t(`commands:petExpedition.mapLocationExpeditions.${location.mapLocationId}`);
	const label = location.isDistantExpedition ? i18n.t("commands:petExpedition.distantExpeditionPrefix", {location: name}) : name;
	return i18n.t("app:expedition.locationName", {icon: AppIcons.getIcon(`expedition.locations.${location.locationType}`), name: label});
}

export function expeditionRisk(category: string): string {
	return i18n.t("app:expedition.locationName", {icon: AppIcons.getIcon(`expedition.risk.${category}`), name: i18n.t(`commands:petExpedition.riskCategories.${category}`)});
}