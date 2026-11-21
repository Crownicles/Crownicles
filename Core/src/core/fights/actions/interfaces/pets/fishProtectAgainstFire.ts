import {
	PetAssistanceResult, PetAssistanceState
} from "../../../../../../../Lib/src/types/PetAssistanceResult";
import { PetAssistanceFunc } from "../../../../../data/PetAssistance";
import { PlayerBaseFighter } from "../../../fighter/PlayerBaseFighter";
import { FightConstants } from "../../../../../../../Lib/src/constants/FightConstants";
import { PetConstants } from "../../../../../../../Lib/src/constants/PetConstants";

const use: PetAssistanceFunc = (fighter, opponent, _turn, _fightController): Promise<PetAssistanceResult | null> => {
	if (fighter.alteration?.id === FightConstants.FIGHT_ACTIONS.ALTERATION.BURNED) {
		// The fish is afraid of a shark taking part in the fight
		if (opponent instanceof PlayerBaseFighter && opponent.pet?.typeId === PetConstants.PETS.SHARK) {
			return Promise.resolve({
				assistanceStatus: PetAssistanceState.AFRAID
			});
		}

		// Check if the fighter is burning
		fighter.removeAlteration();
		return Promise.resolve({
			assistanceStatus: PetAssistanceState.SUCCESS
		});
	}
	return Promise.resolve(null);
};

export default use;
