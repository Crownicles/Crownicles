import {
	PetAssistanceResult, PetAssistanceState
} from "../../../../../../../Lib/src/types/PetAssistanceResult";
import { PetAssistanceFunc } from "../../../../../data/PetAssistance";
import { FightActionController } from "../../FightActionController";
import { FightActionType } from "../../../../../../../Lib/src/types/FightActionType";
import { FightStatBuffed } from "../../../../../../../Lib/src/types/FightActionResult";
import { FightStatModifierOperation } from "../../../../../../../Lib/src/types/FightStatModifierOperation";
import { RandomUtils } from "../../../../../../../Lib/src/utils/RandomUtils";

const use: PetAssistanceFunc = (fighter, opponent, turn, _fightController): Promise<PetAssistanceResult | null> => {
	// Does nothing first turn or if there is no energy to regen.
	if (turn <= 2 || fighter.getEnergy() === fighter.getMaxEnergy()) {
		return Promise.resolve(null);
	}

	if (!(opponent.getLastFightActionUsed()?.type === FightActionType.MAGIC || fighter.getLastFightActionUsed()?.type === FightActionType.MAGIC)) {
		return Promise.resolve(null);
	}

	// A magic attack was used during this turn, rainbow power will activate
	const result: PetAssistanceResult = {
		assistanceStatus: PetAssistanceState.SUCCESS
	};

	FightActionController.applyBuff(result, {
		selfTarget: true,
		stat: FightStatBuffed.ENERGY,
		operator: FightStatModifierOperation.ADDITION,
		value: RandomUtils.crowniclesRandom.integer(1, Math.max(fighter.getMaxEnergy() * 0.04, 5))
	}, fighter, undefined);

	return Promise.resolve(result);
};

export default use;
