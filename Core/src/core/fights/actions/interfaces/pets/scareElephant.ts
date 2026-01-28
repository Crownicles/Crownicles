import {
	PetAssistanceResult, PetAssistanceState
} from "../../../../../../../Lib/src/types/PetAssistanceResult";
import { PetAssistanceFunc } from "../../../../../data/PetAssistance";

const use: PetAssistanceFunc = (_fighter, _opponent, turn, _fightController): Promise<PetAssistanceResult | null> => {
	if (turn > 2) {
		return Promise.resolve(null);
	}
	return Promise.resolve({
		assistanceStatus: PetAssistanceState.GENERAL_EFFECT
	});
};

export default use;
