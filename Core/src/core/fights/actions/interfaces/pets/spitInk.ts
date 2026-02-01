import { FightActionController } from "../../FightActionController";
import { PetAssistanceFunc } from "../../../../../data/PetAssistance";
import {
	PetAssistanceResult, PetAssistanceState
} from "../../../../../../../Lib/src/types/PetAssistanceResult";
import { FightAlterations } from "../../FightAlterations";

const use: PetAssistanceFunc = (_fighter, opponent, turn, _fightController): Promise<PetAssistanceResult | null> => {
	if (turn < 10 || turn > 11 || opponent.hasFightAlteration()) {
		return Promise.resolve(null);
	}

	const result: PetAssistanceResult = {
		assistanceStatus: PetAssistanceState.SUCCESS
	};

	// Blind the opponent at the start of the fight
	FightActionController.applyAlteration(result, {
		selfTarget: false,
		alteration: FightAlterations.BLIND
	}, opponent);

	return Promise.resolve(result);
};

export default use;
