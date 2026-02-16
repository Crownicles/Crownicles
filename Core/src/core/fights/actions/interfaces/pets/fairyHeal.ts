import {
	PetAssistanceResult, PetAssistanceState
} from "../../../../../../../Lib/src/types/PetAssistanceResult";
import { PetAssistanceFunc } from "../../../../../data/PetAssistance";
import { FightActionController } from "../../FightActionController";
import { FightStatBuffed } from "../../../../../../../Lib/src/types/FightActionResult";
import { FightStatModifierOperation } from "../../../../../../../Lib/src/types/FightStatModifierOperation";
import { RandomUtils } from "../../../../../../../Lib/src/utils/RandomUtils";

const MIN_ACTIVATION_TURN = 3;
const ACTIVATION_PROBABILITY = 0.35;
const MIN_HEAL = 8;
const MIN_HEAL_PERCENTAGE = 0.03;
const MAX_HEAL_PERCENTAGE = 0.06;

const use: PetAssistanceFunc = (fighter, _opponent, turn, _fightController): Promise<PetAssistanceResult | null> => {
	if (turn < MIN_ACTIVATION_TURN || fighter.getEnergy() === fighter.getMaxEnergy()) {
		return Promise.resolve(null);
	}

	if (!RandomUtils.crowniclesRandom.bool(ACTIVATION_PROBABILITY)) {
		return Promise.resolve(null);
	}

	const maxEnergy = fighter.getMaxEnergy();
	const healAmount = Math.max(
		MIN_HEAL,
		RandomUtils.crowniclesRandom.integer(
			Math.floor(maxEnergy * MIN_HEAL_PERCENTAGE),
			Math.floor(maxEnergy * MAX_HEAL_PERCENTAGE)
		)
	);

	const result: PetAssistanceResult = {
		assistanceStatus: PetAssistanceState.SUCCESS
	};

	FightActionController.applyBuff(result, {
		selfTarget: true,
		stat: FightStatBuffed.ENERGY,
		operator: FightStatModifierOperation.ADDITION,
		value: healAmount
	}, fighter, undefined);

	return Promise.resolve(result);
};

export default use;
