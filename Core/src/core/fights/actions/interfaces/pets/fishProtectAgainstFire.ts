import {
	PetAssistanceResult, PetAssistanceState
} from "../../../../../../../Lib/src/types/PetAssistanceResult";
import { PetAssistanceFunc } from "../../../../../data/PetAssistance";
import { RealPlayerFighter } from "../../../fighter/RealPlayerFighter";
import { AiPlayerFighter } from "../../../fighter/AiPlayerFighter";
import { PetEntities } from "../../../../database/game/models/PetEntity";
import { FightConstants } from "../../../../../../../Lib/src/constants/FightConstants";
import { PetConstants } from "../../../../../../../Lib/src/constants/PetConstants";

const use: PetAssistanceFunc = async (fighter, opponent, _turn, _fightController): Promise<PetAssistanceResult | null> => {
	if (fighter.alteration?.id === FightConstants.FIGHT_ACTIONS.ALTERATION.BURNED) {
		if (opponent instanceof RealPlayerFighter || opponent instanceof AiPlayerFighter) {
			// Test if the opponent has a shark
			const pet = await PetEntities.getById(opponent.player.petId);
			if (pet?.typeId === PetConstants.PETS.SHARK) {
				return Promise.resolve({
					assistanceStatus: PetAssistanceState.AFRAID
				});
			}
		}

		// Check if the fighter is burning
		fighter.removeAlteration();
		return Promise.resolve({
			assistanceStatus: PetAssistanceState.SUCCESS
		});
	}
	return null;
};

export default use;
