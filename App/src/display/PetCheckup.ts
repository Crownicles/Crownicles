import { ShopPetCheckupRes } from "ws-packets/src/fromServer/shop/ShopRes";
import { PetSex } from "ws-packets/src/objects/OwnedPet";
import {
	petIcon, petTypeName
} from "@/src/display/PetDisplay";
import { formatDurationMinutes } from "@/src/display/ItemEffects";
import {
	biomeName, isExpeditionLocationType
} from "@/src/display/PetExpedition";
import { i18n } from "@/src/translations/i18n";
import { randomTranslation } from "@/src/translations/RandomTranslation";

const KEY = "commands:shop.shopItems.lovePointsValue";
const MILLISECONDS_PER_MINUTE = 60_000;

function shortPet(typeId: number, sex: PetSex, nickname?: string): string {
	return i18n.t("commands:pet.shortPetField", {
		emote: petIcon({
			typeId, sex
		}),
		name: nickname || petTypeName({
			typeId, sex
		})
	});
}

/** The vet names the biomes as the expeditions do; one a newer server sends keeps its own name. */
function locationType(type: string): string {
	return isExpeditionLocationType(type) ? biomeName(type) : type;
}

function expeditionSection(pet: ShopPetCheckupRes): string {
	const liked = pet.likedExpeditionTypes ?? [];
	const disliked = pet.dislikedExpeditionTypes ?? [];
	if (liked.length === 0 && disliked.length === 0) {
		return i18n.t(`${KEY}.noPreferences`);
	}
	return i18n.t(`${KEY}.expeditionPreferences`, {
		likedLocations: liked.length > 0 ? i18n.t(`${KEY}.likedLocations`, { locations: liked.map(locationType).join(", ") }) : "",
		dislikedLocations: disliked.length > 0 ? i18n.t(`${KEY}.dislikedLocations`, { locations: disliked.map(locationType).join(", ") }) : ""
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

export type PetCheckupSummary = {
	advice: string;
	ageComment: string;
	lovePoints: {
		actual: number;
		max: number;
	};
	lovePointsGained: number;
	force: number;
	speed: number;
	diet: string;
	feedInterval: string;
	nextFeed: string;
	fightEffects: string[];
	expeditions: string;
	dwarfAside: string;
};

/** The vet's findings, split into fields so the screen can lay them out. */
export function petCheckupSummary(pet: ShopPetCheckupRes): PetCheckupSummary {
	return {
		advice: randomTranslation(`${KEY}.advice.${pet.loveLevel}`),
		ageComment: i18n.t(`${KEY}.ageComment`, {
			context: pet.ageCategory, age: pet.petId - 1
		}),
		lovePoints: {
			actual: pet.lovePoints,
			max: pet.maxLovePoints
		},
		lovePointsGained: pet.lovePointsGained ?? 0,
		force: pet.force,
		speed: pet.speed,
		diet: i18n.t("models:diet", { context: pet.diet }),
		feedInterval: formatDurationMinutes(pet.feedDelay / MILLISECONDS_PER_MINUTE),
		nextFeed: nextFeed(pet),
		fightEffects: [
			randomTranslation(`${KEY}.commentOnFightEffect.${pet.fightAssistId}`),
			...pet.secondFightAssistId
				? [i18n.t(`${KEY}.secondFightEffect`, { comment: randomTranslation(`${KEY}.commentOnFightEffect.${pet.secondFightAssistId}`) })]
				: []
		],
		expeditions: expeditionSection(pet),
		dwarfAside: dwarfAside(pet)
	};
}
