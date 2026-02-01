import {
	PetAssistanceResult, PetAssistanceState
} from "../../../../../../../Lib/src/types/PetAssistanceResult";
import { PetAssistanceFunc } from "../../../../../data/PetAssistance";
import { FightActionController } from "../../FightActionController";
import { FightStatBuffed } from "../../../../../../../Lib/src/types/FightActionResult";
import { FightStatModifierOperation } from "../../../../../../../Lib/src/types/FightStatModifierOperation";
import { RandomUtils } from "../../../../../../../Lib/src/utils/RandomUtils";

const use: PetAssistanceFunc = (fighter, _opponent, turn, _fightController): Promise<PetAssistanceResult | null> => {
	// Execute at turn 5 / 6
	if (turn !== 5 && turn !== 6) {
		return Promise.resolve(null);
	}

	const result: PetAssistanceResult = {
		assistanceStatus: PetAssistanceState.SUCCESS
	};

	// Regen the fighter's energy
	FightActionController.applyBuff(result, {
		selfTarget: true,
		stat: FightStatBuffed.ENERGY,
		operator: FightStatModifierOperation.ADDITION,
		value: RandomUtils.crowniclesRandom.integer(18, 30)
	}, fighter, undefined);

	return Promise.resolve(result);
};

export default use;
