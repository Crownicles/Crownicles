import {
	PetAssistanceResult, PetAssistanceState
} from "../../../../../../../Lib/src/types/PetAssistanceResult";
import { PetAssistanceFunc } from "../../../../../data/PetAssistance";
import { FightConstants } from "../../../../../../../Lib/src/constants/FightConstants";

const use: PetAssistanceFunc = (fighter, _opponent, _turn, _fightController): Promise<PetAssistanceResult | null> => {
	if (fighter.alteration?.id === FightConstants.FIGHT_ACTIONS.ALTERATION.FROZEN) {
		// Check if the fighter is frozen
		fighter.removeAlteration();
		return Promise.resolve({
			assistanceStatus: PetAssistanceState.SUCCESS
		});
	}
	return Promise.resolve(null);
};

export default use;
