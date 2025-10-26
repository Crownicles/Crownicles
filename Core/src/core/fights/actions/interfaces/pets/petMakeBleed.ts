import { FightActionController } from "../../FightActionController";
import { PetAssistanceFunc } from "../../../../../data/PetAssistance";
import {
	PetAssistanceResult, PetAssistanceState
} from "../../../../../../../Lib/src/types/PetAssistanceResult";
import { FightAlterations } from "../../FightAlterations";
import { FightStatBuffed } from "../../../../../../../Lib/src/types/FightActionResult";
import { FightStatModifierOperation } from "../../../../../../../Lib/src/types/FightStatModifierOperation";
import { RandomUtils } from "../../../../../../../Lib/src/utils/RandomUtils";
import { Fighter } from "../../../fighter/Fighter";

function makeBleed(opponent: Fighter, result: PetAssistanceResult): void {
	// Make bleed the opponent
	FightActionController.applyAlteration(result, {
		selfTarget: false,
		alteration: FightAlterations.BLEEDING
	}, opponent);
}

const use: PetAssistanceFunc = (fighter, opponent, turn, _fightController): Promise<PetAssistanceResult | null> => {
	if ((turn + 4) % 7 <= 1) {
		return null;
	}
	const result: PetAssistanceResult = {
		assistanceStatus: PetAssistanceState.SUCCESS
	};

	if (!opponent.hasFightAlteration()) {
		makeBleed(opponent, result);
	}

	const pointsToHealFighter = fighter.getMaxEnergy() - fighter.getEnergy();

	if (pointsToHealFighter > 0 && opponent.hasFightAlteration() && opponent.alteration.id === FightAlterations.BLEEDING) {
		FightActionController.applyBuff(result, {
			selfTarget: true,
			stat: FightStatBuffed.ENERGY,
			operator: FightStatModifierOperation.ADDITION,
			value: RandomUtils.crowniclesRandom.integer(15, Math.max(fighter.getMaxEnergy() * 0.07, 20))
		}, fighter, this);
	}

	return Promise.resolve(result);
};

export default use;
