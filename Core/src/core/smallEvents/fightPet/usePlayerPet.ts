import { PetEntities } from "../../database/game/models/PetEntity";
import { FightPetActionFunc } from "../../../data/FightPetAction";
import { PetConstants } from "../../../../../Lib/src/constants/PetConstants";
import { SmallEventConstants } from "../../../../../Lib/src/constants/SmallEventConstants";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";
import { PetDataController } from "../../../data/Pet";
import { PetUtils } from "../../utils/PetUtils";

export const fightPetAction: FightPetActionFunc = async (player, pet) => {
	const playerPetEntity = await PetEntities.getById(player.petId);
	if (!playerPetEntity) {
		return false; // Player doesn't have a pet, so cannot use one in the fight
	}

	const playerPet = PetDataController.instance.getById(playerPetEntity.typeId);

	const petLoveBonusOrMalus = playerPetEntity.getLoveLevelNumber() === PetConstants.LOVE_LEVEL.TRAINED
		? SmallEventConstants.FIGHT_PET.BONUS_FOR_TRAINED_PETS
		: playerPetEntity.getLoveLevelNumber() === PetConstants.LOVE_LEVEL.FEISTY
			? SmallEventConstants.FIGHT_PET.MALUS_FOR_FEISTY_PETS
			: 0;

	const dietBonusOrMalus = pet.diet === PetConstants.RESTRICTIVES_DIETS.CARNIVOROUS && playerPet.diet === PetConstants.RESTRICTIVES_DIETS.HERBIVOROUS
		? SmallEventConstants.FIGHT_PET.MALUS_FOR_WRONG_DIET
		: pet.diet === PetConstants.RESTRICTIVES_DIETS.HERBIVOROUS && playerPet.diet === PetConstants.RESTRICTIVES_DIETS.CARNIVOROUS
			? SmallEventConstants.FIGHT_PET.BONUS_FOR_RIGHT_DIET
			: 0;

	const enemyPetVigor = PetUtils.getPetVigor(pet, 0, { enraged: true });
	const playerPetVigor = PetUtils.getPetVigor(playerPet, playerPetEntity.lovePoints);

	// Calculate the success probability using vigor difference and love/diet modifiers
	const successProbability =
		SmallEventConstants.FIGHT_PET.BASE_PET_FIGHTS_SUCCESS_RATE
		+ (SmallEventConstants.FIGHT_PET.PLAYERS_RARITY_BONUS_BOOST + petLoveBonusOrMalus + dietBonusOrMalus + playerPetVigor - enemyPetVigor)
		* SmallEventConstants.FIGHT_PET.SUCCESS_PROBABILITY_FOR_RARITY_DIFFERENCE;

	// Ensure the success probability is within a reasonable range
	const clampedSuccessProbability = Math.max(SmallEventConstants.FIGHT_PET.MIN_PROBABILITY_PET_VS_PET, Math.min(SmallEventConstants.FIGHT_PET.MAX_PROBABILITY_PET_VS_PET, successProbability));

	return RandomUtils.crowniclesRandom.bool(clampedSuccessProbability);
};
