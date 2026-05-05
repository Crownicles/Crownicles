import { ShopItem } from "../../../../Lib/src/packets/interaction/ReactionCollectorShop";
import {
	NumberChangeReason, ShopItemType
} from "../../../../Lib/src/constants/LogsConstants";
import { ShopConstants } from "../../../../Lib/src/constants/ShopConstants";
import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	Player, Players
} from "../database/game/models/Player";
import {
	PetEntities, PetEntity
} from "../database/game/models/PetEntity";
import { PetDataController } from "../../data/Pet";
import {
	CommandMissionShopNoPet,
	CommandMissionShopPetInformation
} from "../../../../Lib/src/packets/commands/CommandMissionShopPacket";
import {
	PetConstants, PetDiet
} from "../../../../Lib/src/constants/PetConstants";
import { SexTypeShort } from "../../../../Lib/src/constants/StringConstants";
import { RandomPetDwarfInfo } from "../../../../Lib/src/types/RandomPetDwarfInfo";
import { getAiPetBehavior } from "../fights/PetAssistManager";
import { PetUtils } from "./PetUtils";
import { DwarfPetsSeen } from "../database/game/models/DwarfPetsSeen";
import { getPetExpeditionPreferences } from "../../../../Lib/src/constants/ExpeditionConstants";

/**
 * Apply veterinarian care to the pet if it needs it.
 * Returns the actual love points gained (0 if no care needed), accounting for
 * blessing multipliers and the MAX_LOVE_POINTS cap.
 */
async function applyVeterinarianCare(pet: PetEntity, player: Player, response: CrowniclesPacket[]): Promise<number> {
	if (!pet.needsVeterinarianCare()) {
		return 0;
	}
	const lovePointsBefore = pet.lovePoints;
	await pet.changeLovePoints({
		player,
		amount: ShopConstants.VETERINARIAN_LOVE_POINTS_GAIN,
		response,
		reason: NumberChangeReason.SHOP
	});
	await pet.save({ fields: ["lovePoints"] });
	return pet.lovePoints - lovePointsBefore;
}

async function buildRandomPetDwarfInfo(player: Player): Promise<RandomPetDwarfInfo | undefined> {
	const randomPetNotShownToDwarfId = await DwarfPetsSeen.getRandomPetNotSeenId(player);
	if (randomPetNotShownToDwarfId === 0) {
		return undefined;
	}
	const randomPetDwarfModel = PetDataController.instance.getById(randomPetNotShownToDwarfId);
	if (!randomPetDwarfModel) {
		return undefined;
	}
	return {
		typeId: randomPetDwarfModel.id,
		sex: PetConstants.SEX.MALE as SexTypeShort,
		numberOfPetsNotSeen: await DwarfPetsSeen.getNumberOfPetsNotSeen(player)
	};
}

function getExpeditionPreferenceLists(typeId: number): {
	likedExpeditionTypes: string[]; dislikedExpeditionTypes: string[];
} {
	const preferences = getPetExpeditionPreferences(typeId);
	return {
		likedExpeditionTypes: preferences?.liked ? [...preferences.liked] : [],
		dislikedExpeditionTypes: preferences?.disliked ? [...preferences.disliked] : []
	};
}

async function buildPetInformationPacket(pet: PetEntity, player: Player, lovePointsGained: number): Promise<CrowniclesPacket> {
	const petModel = PetDataController.instance.getById(pet.typeId)!;
	const randomPetDwarf = await buildRandomPetDwarfInfo(player);
	const {
		likedExpeditionTypes, dislikedExpeditionTypes
	} = getExpeditionPreferenceLists(pet.typeId);

	return makePacket(CommandMissionShopPetInformation, {
		nickname: pet.nickname,
		petId: pet.id,
		typeId: petModel.id,
		sex: pet.sex as SexTypeShort,
		loveLevel: pet.getLoveLevelNumber(),
		lovePoints: pet.lovePoints,
		diet: petModel.diet as PetDiet,
		nextFeed: pet.getFeedCooldown(petModel),
		force: petModel.force,
		speed: petModel.speed,
		feedDelay: (petModel.feedDelay ?? 1) * PetConstants.BREED_COOLDOWN,
		fightAssistId: getAiPetBehavior(petModel.id)?.id ?? "",
		ageCategory: PetUtils.getAgeCategory(pet.id),
		likedExpeditionTypes,
		dislikedExpeditionTypes,
		lovePointsGained: lovePointsGained > 0 ? lovePointsGained : undefined,
		...randomPetDwarf && { randomPetDwarf }
	});
}

export function getVeterinarianShopItem(): ShopItem {
	return {
		id: ShopItemType.LOVE_POINTS_VALUE,
		price: ShopConstants.VETERINARIAN_PRICE,
		amounts: [1],
		buyCallback: async (response: CrowniclesPacket[], playerId: number): Promise<boolean> => {
			const player = await Players.getById(playerId);
			if (player.petId === null) {
				response.push(makePacket(CommandMissionShopNoPet, {}));
				return false;
			}
			const pet = await PetEntities.getById(player.petId);
			if (!pet) {
				response.push(makePacket(CommandMissionShopNoPet, {}));
				return false;
			}

			const lovePointsGained = await applyVeterinarianCare(pet, player, response);
			response.push(await buildPetInformationPacket(pet, player, lovePointsGained));
			return true;
		}
	};
}
