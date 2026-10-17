import PetEntity from "../../database/game/models/PetEntity";
import { PetDataController } from "../../../data/Pet";
import { PetConstants } from "../../../../../Lib/src/constants/PetConstants";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";

/**
 * Generate the pet of a king guard: every pet can be drawn, the ones with the most force more often
 */
export function generateKingGuardPet(): PetEntity {
	const pet = RandomUtils.weightedPick(PetDataController.instance.getAllValues().filter(pet => pet.rarity !== 0), pet => pet.force);
	return PetEntity.build({
		typeId: pet.id,
		sex: RandomUtils.crowniclesRandom.bool() ? PetConstants.SEX.MALE : PetConstants.SEX.FEMALE,
		nickname: null,
		lovePoints: PetConstants.BASE_LOVE
	});
}
