import { FightActionController } from "../../FightActionController";
import { PetAssistanceFunc } from "../../../../../data/PetAssistance";
import {
	PetAssistanceResult, PetAssistanceState
} from "../../../../../../../Lib/src/types/PetAssistanceResult";
import { FightAlterations } from "../../FightAlterations";
import { FightUtils } from "../../../../utils/FightUtils";

const use: PetAssistanceFunc = (_fighter, opponent, turn, _fightController): Promise<PetAssistanceResult | null> => {
	if (FightUtils.shouldSkipPetEffect(turn, opponent)) {
		return null;
	}

	const result: PetAssistanceResult = {
		assistanceStatus: PetAssistanceState.SUCCESS
	};

	// Confuse the opponent at the beginning of the fight
	FightActionController.applyAlteration(result, {
		selfTarget: false,
		alteration: FightAlterations.CONFUSED
	}, opponent);

	return Promise.resolve(result);
};

export default use;
