import {ShopPetCheckupRes} from "ws-packets/src/fromServer/shop/ShopRes";
import {PetSex} from "ws-packets/src/objects/OwnedPet";
import {AppIcons} from "@/src/AppIcons";
import {petIcon, petTypeName} from "@/src/display/PetDisplay";
import {formatDurationMinutes} from "@/src/display/ItemEffects";
import {i18n} from "@/src/translations/i18n";
import {randomTranslation} from "@/src/translations/RandomTranslation";

const KEY = "commands:shop.shopItems.lovePointsValue";
const SECONDS_PER_MINUTE = 60;
const MILLISECONDS_PER_MINUTE = 60_000;

function shortPet(typeId: number, sex: PetSex, nickname?: string): string {
	return i18n.t("commands:pet.shortPetField", {
		emote: petIcon({typeId, sex}),
		name: nickname || petTypeName({typeId, sex})
	});
}

function locationType(type: string): string {
	return `${AppIcons.getIconOrNull(`expedition.locations.${type}`) ?? ""} ${i18n.t(`models:map_types.${type}.name`)}`.trim();
}

function expeditionSection(pet: ShopPetCheckupRes): string {
	const liked = pet.likedExpeditionTypes ?? [];
	const disliked = pet.dislikedExpeditionTypes ?? [];
	if (liked.length === 0 && disliked.length === 0) {
		return i18n.t(`${KEY}.noPreferences`);
	}
	return i18n.t(`${KEY}.expeditionPreferences`, {
		likedLocations: liked.length > 0 ? i18n.t(`${KEY}.likedLocations`, {locations: liked.map(locationType).join(", ")}) : "",
		dislikedLocations: disliked.length > 0 ? i18n.t(`${KEY}.dislikedLocations`, {locations: disliked.map(locationType).join(", ")}) : ""
	});
}

/** The vet counts the wait in whole minutes, where Discord leans on its own relative timestamps. */
function nextFeed(pet: ShopPetCheckupRes): string {
	return pet.nextFeed <= 0
		? i18n.t(`${KEY}.petIsHungry`)
		: formatDurationMinutes(pet.nextFeed / MILLISECONDS_PER_MINUTE);
}

function dwarfAside(pet: ShopPetCheckupRes): string {
	return pet.randomPetDwarf
		? randomTranslation(`${KEY}.dwarf`, {
			pet: shortPet(pet.randomPetDwarf.typeId, pet.randomPetDwarf.sex),
			numberOfPetsNotSeen: pet.randomPetDwarf.numberOfPetsNotSeen
		})
		: "";
}

/** The very report the Discord vet hands over, word for word. */
export function petCheckupReport(pet: ShopPetCheckupRes): string {
	const report = i18n.t(`${KEY}.giveDesc`, {
		petName: shortPet(pet.typeId, pet.sex, pet.nickname),
		commentOnResult: randomTranslation(`${KEY}.advice.${pet.loveLevel}`),
		commentOnPetAge: i18n.t(`${KEY}.ageComment`, {context: pet.ageCategory, age: pet.petId - 1}),
		actualLP: pet.lovePoints,
		maxLovePoints: pet.maxLovePoints,
		diet: i18n.t("models:diet", {context: pet.diet}),
		force: pet.force,
		speed: pet.speed,
		feedDelay: formatDurationMinutes(pet.feedDelay / SECONDS_PER_MINUTE),
		nextFeed: nextFeed(pet),
		commentOnFightEffect: randomTranslation(`${KEY}.commentOnFightEffect.${pet.fightAssistId}`),
		expeditionSection: expeditionSection(pet),
		dwarfPet: dwarfAside(pet)
	});
	return pet.lovePointsGained
		? report + i18n.t(`${KEY}.lovePointsGained`, {amount: pet.lovePointsGained})
		: report;
}
