import {
	PetAssistanceResult, PetAssistanceState
} from "../../../../../../../Lib/src/types/PetAssistanceResult";
import { PetAssistanceFunc } from "../../../../../data/PetAssistance";
import { FightActionController } from "../../FightActionController";
import { FightStatBuffed } from "../../../../../../../Lib/src/types/FightActionResult";
import { FightStatModifierOperation } from "../../../../../../../Lib/src/types/FightStatModifierOperation";
import { MonsterFighter } from "../../../fighter/MonsterFighter";

const use: PetAssistanceFunc = (fighter, opponent, turn, _fightController): Promise<PetAssistanceResult | null> => {
	// If not turn 4 or 5, do nothing, and if the opponent is a monster, do nothing
	if (turn < 4 || turn > 5 || opponent instanceof MonsterFighter) {
		return Promise.resolve(null);
	}

	const result: PetAssistanceResult = {
		assistanceStatus: PetAssistanceState.SUCCESS
	};

	const pointsToHealFighter = fighter.getMaxEnergy() - fighter.getEnergy();
	const pointsToHealOpponent = opponent.getMaxEnergy() - opponent.getEnergy();
	if (pointsToHealFighter <= 0 && pointsToHealOpponent <= 0) {
		return Promise.resolve({
			assistanceStatus: PetAssistanceState.GENERAL_EFFECT
		});
	}
	if (pointsToHealFighter > 0) {
		FightActionController.applyBuff(result, {
			selfTarget: true,
			stat: FightStatBuffed.ENERGY,
			operator: FightStatModifierOperation.ADDITION,
			value: pointsToHealFighter
		}, fighter, undefined);
	}
	if (pointsToHealOpponent > 0) {
		FightActionController.applyBuff(result, {
			selfTarget: false,
			stat: FightStatBuffed.ENERGY,
			operator: FightStatModifierOperation.ADDITION,
			value: pointsToHealOpponent
		}, opponent, undefined);
	}
	return Promise.resolve(result);
};

export default use;
