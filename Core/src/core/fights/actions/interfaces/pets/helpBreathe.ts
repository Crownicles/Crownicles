import {
	PetAssistanceResult, PetAssistanceState
} from "../../../../../../../Lib/src/types/PetAssistanceResult";
import { PetAssistanceFunc } from "../../../../../data/PetAssistance";
import { RandomUtils } from "../../../../../../../Lib/src/utils/RandomUtils";
import { FightActionController } from "../../FightActionController";
import { FightStatBuffed } from "../../../../../../../Lib/src/types/FightActionResult";
import { FightStatModifierOperation } from "../../../../../../../Lib/src/types/FightStatModifierOperation";

const use: PetAssistanceFunc = (fighter, _opponent, _turn, _fightController): Promise<PetAssistanceResult | null> => {
	// 80 % of the time, nothing happens
	if (RandomUtils.crowniclesRandom.bool(0.80) || fighter.getBreath() === fighter.getMaxBreath()) {
		return Promise.resolve(null);
	}

	const result: PetAssistanceResult = {
		assistanceStatus: PetAssistanceState.SUCCESS
	};

	// Give back to the fighter the amount of breath used by the last action
	FightActionController.applyBuff(result, {
		selfTarget: true,
		stat: FightStatBuffed.BREATH,
		operator: FightStatModifierOperation.ADDITION,
		value: 1
	}, fighter, undefined);

	return Promise.resolve(result);
};

export default use;
