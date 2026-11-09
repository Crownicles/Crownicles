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
const APP_KEY = "app:city.checkup";
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

/** The biomes the pet thrives in and the ones it distrusts, each named with its landscape emoji; neither when it adapts to every terrain. */
export type ExpeditionAffinities = {
	liked?: string;
	disliked?: string;
};

function locationList(types: string[] | undefined): string {
	return (types ?? []).map(locationType).join(", ");
}

function expeditionAffinities(pet: ShopPetCheckupRes): ExpeditionAffinities {
	const liked = locationList(pet.likedExpeditionTypes);
	const disliked = locationList(pet.dislikedExpeditionTypes);
	return {
		...liked ? { liked } : {},
		...disliked ? { disliked } : {}
	};
}

/** Hungry now, or fed for a while yet: the vet counts the wait in whole minutes, where Discord leans on its own relative timestamps. */
function appetite(pet: ShopPetCheckupRes): string {
	return pet.nextFeed <= 0
		? i18n.t(`${KEY}.petIsHungry`)
		: i18n.t(`${APP_KEY}.fedFor`, { duration: formatDurationMinutes(pet.nextFeed / MILLISECONDS_PER_MINUTE) });
}

function fightEffects(pet: ShopPetCheckupRes): string[] {
	return [
		randomTranslation(`${KEY}.commentOnFightEffect.${pet.fightAssistId}`),
		...pet.secondFightAssistId
			? [i18n.t(`${APP_KEY}.secondFightEffect`, { comment: randomTranslation(`${KEY}.commentOnFightEffect.${pet.secondFightAssistId}`) })]
			: []
	];
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
	appetite: string;
	fightEffects: string[];
	expeditions: ExpeditionAffinities;
	dwarfAside: string;
};

/** The vet's findings, split into fields so the screen can lay them out. */
export function petCheckupSummary(pet: ShopPetCheckupRes): PetCheckupSummary {
	return {

		// The vet's advice goes on from the pet's name, as Discord writes it.
		advice: i18n.t(`${APP_KEY}.advice`, {
			pet: shortPet(pet.typeId, pet.sex, pet.nickname), advice: randomTranslation(`${KEY}.advice.${pet.loveLevel}`)
		}),
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
		appetite: appetite(pet),
		fightEffects: fightEffects(pet),
		expeditions: expeditionAffinities(pet),
		dwarfAside: dwarfAside(pet)
	};
}
