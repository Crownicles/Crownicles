import { FightActionController } from "../../FightActionController";
import { PetAssistanceFunc } from "../../../../../data/PetAssistance";
import {
	PetAssistanceResult, PetAssistanceState
} from "../../../../../../../Lib/src/types/PetAssistanceResult";
import { FightAlterations } from "../../FightAlterations";
import { FightActionType } from "../../../../../../../Lib/src/types/FightActionType";
import { RandomUtils } from "../../../../../../../Lib/src/utils/RandomUtils";

const use: PetAssistanceFunc = (_fighter, opponent, turn, _fightController): Promise<PetAssistanceResult | null> => {
	// Only do something if the last action was a physical attack
	if (turn > 1 && opponent.getLastFightActionUsed()?.type !== FightActionType.PHYSICAL) {
		return Promise.resolve(null);
	}

	const result: PetAssistanceResult = {
		damages: 1,
		assistanceStatus: PetAssistanceState.FAILURE
	};

	// 9 % chance of blinding the opponent
	if (RandomUtils.crowniclesRandom.bool(0.09) && !opponent.hasFightAlteration()) {
		FightActionController.applyAlteration(result, {
			selfTarget: false,
			alteration: FightAlterations.BLIND
		}, opponent);
		result.assistanceStatus = PetAssistanceState.SUCCESS;
	}

	return Promise.resolve(result);
};

export default use;
