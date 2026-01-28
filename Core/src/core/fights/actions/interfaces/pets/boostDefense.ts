import {
	PetAssistanceResult, PetAssistanceState
} from "../../../../../../../Lib/src/types/PetAssistanceResult";
import { PetAssistanceFunc } from "../../../../../data/PetAssistance";
import { FightActionController } from "../../FightActionController";
import { FightStatBuffed } from "../../../../../../../Lib/src/types/FightActionResult";
import { FightStatModifierOperation } from "../../../../../../../Lib/src/types/FightStatModifierOperation";

const use: PetAssistanceFunc = (fighter, _opponent, turn, _fightController): Promise<PetAssistanceResult | null> => {
	// Execute at the start of the fight
	if (turn > 2) {
		return Promise.resolve(null);
	}

	const result: PetAssistanceResult = {
		assistanceStatus: PetAssistanceState.SUCCESS
	};

	// Boost the fighter's defense and lower its speed
	FightActionController.applyBuff(result, {
		selfTarget: true,
		stat: FightStatBuffed.DEFENSE,
		operator: FightStatModifierOperation.MULTIPLIER,
		value: 1.55
	}, fighter, undefined);

	FightActionController.applyBuff(result, {
		selfTarget: true,
		stat: FightStatBuffed.SPEED,
		operator: FightStatModifierOperation.MULTIPLIER,
		value: 0.8
	}, fighter, undefined);

	return Promise.resolve(result);
};

export default use;
