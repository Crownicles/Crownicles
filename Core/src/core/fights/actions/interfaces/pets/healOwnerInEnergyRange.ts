import { FightActionController } from "../../FightActionController";
import { PetAssistanceFunc } from "../../../../../data/PetAssistance";
import {
	PetAssistanceResult, PetAssistanceState
} from "../../../../../../../Lib/src/types/PetAssistanceResult";
import { FightStatBuffed } from "../../../../../../../Lib/src/types/FightActionResult";
import { FightStatModifierOperation } from "../../../../../../../Lib/src/types/FightStatModifierOperation";
import { RandomUtils } from "../../../../../../../Lib/src/utils/RandomUtils";

const MIN_ENERGY_THRESHOLD = 0;
const MAX_ENERGY_THRESHOLD = 320;

const use: PetAssistanceFunc = (fighter, _opponent, _turn, _fightController): Promise<PetAssistanceResult | null> => {
	// Check if the fighter's current energy is within the defined threshold
	const currentEnergy = fighter.getEnergy();
	if (currentEnergy < MIN_ENERGY_THRESHOLD || currentEnergy > MAX_ENERGY_THRESHOLD) {
		return Promise.resolve(null); // Energy is not in the required range
	}

	const result: PetAssistanceResult = {
		assistanceStatus: PetAssistanceState.SUCCESS
	};

	FightActionController.applyBuff(result, {
		selfTarget: false,
		stat: FightStatBuffed.ENERGY,
		operator: FightStatModifierOperation.ADDITION,
		value: RandomUtils.crowniclesRandom.integer(15, Math.max(fighter.getMaxEnergy() * 0.07, 20))
	}, fighter, undefined);

	return Promise.resolve(result);
};

export default use;
