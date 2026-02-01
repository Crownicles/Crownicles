import { PetEntities } from "../../database/game/models/PetEntity";
import { FightPetActionFunc } from "../../../data/FightPetAction";
import { PetConstants } from "../../../../../Lib/src/constants/PetConstants";
import { SmallEventConstants } from "../../../../../Lib/src/constants/SmallEventConstants";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";
import { PetDataController } from "../../../data/Pet";
import { PetUtils } from "../../utils/PetUtils";
import { MathUtils } from "../../utils/MathUtils";

/**
 * Calculate love level bonus/malus for pet fight
 */
function calculateLoveBonusOrMalus(loveLevel: number): number {
	if (loveLevel === PetConstants.LOVE_LEVEL.TRAINED) {
		return SmallEventConstants.FIGHT_PET.BONUS_FOR_TRAINED_PETS;
	}
	if (loveLevel === PetConstants.LOVE_LEVEL.FEISTY) {
		return SmallEventConstants.FIGHT_PET.MALUS_FOR_FEISTY_PETS;
	}
	return 0;
}

/**
 * Calculate diet bonus/malus based on pet diets
 */
function calculateDietBonusOrMalus(enemyDiet: string, playerDiet: string): number {
	const isCarnivorous = PetConstants.RESTRICTIVES_DIETS.CARNIVOROUS;
	const isHerbivorous = PetConstants.RESTRICTIVES_DIETS.HERBIVOROUS;

	if (enemyDiet === isCarnivorous && playerDiet === isHerbivorous) {
		return SmallEventConstants.FIGHT_PET.MALUS_FOR_WRONG_DIET;
	}
	if (enemyDiet === isHerbivorous && playerDiet === isCarnivorous) {
		return SmallEventConstants.FIGHT_PET.BONUS_FOR_RIGHT_DIET;
	}
	return 0;
}

export const fightPetAction: FightPetActionFunc = async (player, pet) => {
	// Check if pet is available (handles expedition check with clone talisman logic)
	if (!await PetUtils.isPetAvailable(player, PetConstants.AVAILABILITY_CONTEXT.SMALL_EVENT)) {
		return false;
	}

	const playerPetEntity = await PetEntities.getById(player.petId);
	if (!playerPetEntity) {
		return false;
	}

	const playerPet = PetDataController.instance.getById(playerPetEntity.typeId)!;
	const petLoveBonusOrMalus = calculateLoveBonusOrMalus(playerPetEntity.getLoveLevelNumber());
	const dietBonusOrMalus = calculateDietBonusOrMalus(pet.diet, playerPet.diet);

	const enemyPetVigor = PetUtils.getPetVigor(pet, 0, { enraged: true });
	const playerPetVigor = PetUtils.getPetVigor(playerPet, playerPetEntity.lovePoints);

	// Calculate the success probability using vigor difference and love/diet modifiers
	const successProbability =
		SmallEventConstants.FIGHT_PET.BASE_PET_FIGHTS_SUCCESS_RATE
		+ (SmallEventConstants.FIGHT_PET.PLAYERS_RARITY_BONUS_BOOST + petLoveBonusOrMalus + dietBonusOrMalus + playerPetVigor - enemyPetVigor)
		* SmallEventConstants.FIGHT_PET.SUCCESS_PROBABILITY_FOR_RARITY_DIFFERENCE;

	// Ensure the success probability is within a reasonable range
	const clampedSuccessProbability = MathUtils.clamp(
		successProbability,
		SmallEventConstants.FIGHT_PET.MIN_PROBABILITY_PET_VS_PET,
		SmallEventConstants.FIGHT_PET.MAX_PROBABILITY_PET_VS_PET
	);

	return RandomUtils.crowniclesRandom.bool(clampedSuccessProbability);
};
