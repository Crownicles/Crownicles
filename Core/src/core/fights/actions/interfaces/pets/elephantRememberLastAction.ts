import {
	PetAssistanceResult, PetAssistanceState
} from "../../../../../../../Lib/src/types/PetAssistanceResult";
import { PetAssistanceFunc } from "../../../../../data/PetAssistance";
import { PlayerBaseFighter } from "../../../fighter/PlayerBaseFighter";
import { PetConstants } from "../../../../../../../Lib/src/constants/PetConstants";
import { RandomUtils } from "../../../../../../../Lib/src/utils/RandomUtils";
import { FightActionController } from "../../FightActionController";
import { FightStatBuffed } from "../../../../../../../Lib/src/types/FightActionResult";
import { FightStatModifierOperation } from "../../../../../../../Lib/src/types/FightStatModifierOperation";

const use: PetAssistanceFunc = (fighter, opponent, turn, _fightController): Promise<PetAssistanceResult | null> => {
	// Does nothing first turn.
	if (turn <= 2) {
		return Promise.resolve(null);
	}

	// 85 % of the time, nothing happens
	if (RandomUtils.crowniclesRandom.bool(0.85)) {
		return Promise.resolve(null);
	}


	// The elephant is afraid of a mouse taking part in the fight
	if (opponent instanceof PlayerBaseFighter && opponent.pet?.typeId === PetConstants.PETS.MOUSE) {
		return Promise.resolve({
			assistanceStatus: PetAssistanceState.AFRAID
		});
	}

	const lastAction = fighter.getLastFightActionUsed();
	if (!lastAction || lastAction.breath === 0) {
		return Promise.resolve({
			assistanceStatus: PetAssistanceState.FAILURE
		});
	}
	const result: PetAssistanceResult = {
		assistanceStatus: PetAssistanceState.SUCCESS
	};

	// Give back to the fighter the amount of breath used by the last action
	FightActionController.applyBuff(result, {
		selfTarget: true,
		stat: FightStatBuffed.BREATH,
		operator: FightStatModifierOperation.ADDITION,
		value: lastAction.breath
	}, fighter, undefined);

	return Promise.resolve(result);
};

export default use;
