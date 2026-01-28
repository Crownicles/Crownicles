import {
	PetAssistanceResult, PetAssistanceState
} from "../../../../../../../Lib/src/types/PetAssistanceResult";
import { PetAssistanceFunc } from "../../../../../data/PetAssistance";
import { RandomUtils } from "../../../../../../../Lib/src/utils/RandomUtils";

const use: PetAssistanceFunc = (_fighter, _opponent, _turn, _fightController): Promise<PetAssistanceResult | null> => {
	if (RandomUtils.crowniclesRandom.bool(0.9)) {
		return Promise.resolve(null);
	}
	return Promise.resolve({
		assistanceStatus: PetAssistanceState.GENERAL_EFFECT
	});
};

export default use;
