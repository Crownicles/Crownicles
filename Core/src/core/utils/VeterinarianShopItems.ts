import { ShopItem } from "../../../../Lib/src/packets/interaction/ReactionCollectorShop";
import {
	NumberChangeReason, ShopItemType
} from "../../../../Lib/src/constants/LogsConstants";
import { ShopConstants } from "../../../../Lib/src/constants/ShopConstants";
import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { Players } from "../database/game/models/Player";
import { PetEntities } from "../database/game/models/PetEntity";
import { PetDataController } from "../../data/Pet";
import {
	CommandMissionShopNoPet,
	CommandMissionShopPetInformation
} from "../../../../Lib/src/packets/commands/CommandMissionShopPacket";
import {
	PetConstants, PetDiet
} from "../../../../Lib/src/constants/PetConstants";
import { SexTypeShort } from "../../../../Lib/src/constants/StringConstants";
import { getAiPetBehavior } from "../fights/PetAssistManager";
import { PetUtils } from "./PetUtils";
import { DwarfPetsSeen } from "../database/game/models/DwarfPetsSeen";
import { getPetExpeditionPreferences } from "../../../../Lib/src/constants/ExpeditionConstants";

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
			const petModel = PetDataController.instance.getById(pet.typeId)!;
			const randomPetNotShownToDwarfId = await DwarfPetsSeen.getRandomPetNotSeenId(player);
			const randomPetDwarfModel = randomPetNotShownToDwarfId !== 0 ? PetDataController.instance.getById(randomPetNotShownToDwarfId) : null;

			const preferences = getPetExpeditionPreferences(pet.typeId);
			const likedExpeditionTypes = preferences?.liked ? [...preferences.liked] : [];
			const dislikedExpeditionTypes = preferences?.disliked ? [...preferences.disliked] : [];

			let lovePointsGained: number | undefined;
			if (pet.lovePoints < ShopConstants.VETERINARIAN_LOVE_POINTS_THRESHOLD) {
				lovePointsGained = ShopConstants.VETERINARIAN_LOVE_POINTS_GAIN;
				await pet.changeLovePoints({
					player,
					amount: lovePointsGained,
					response,
					reason: NumberChangeReason.SHOP
				});
				await pet.save({ fields: ["lovePoints"] });
			}

			response.push(makePacket(CommandMissionShopPetInformation, {
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
				lovePointsGained,
				...randomPetDwarfModel && {
					randomPetDwarf: {
						typeId: randomPetDwarfModel.id,
						sex: PetConstants.SEX.MALE as SexTypeShort,
						numberOfPetsNotSeen: await DwarfPetsSeen.getNumberOfPetsNotSeen(player)
					}
				}
			}));
			return true;
		}
	};
}
