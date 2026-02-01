import {
	PetAssistanceResult, PetAssistanceState
} from "../../../../../../../Lib/src/types/PetAssistanceResult";
import { FightStatBuffed } from "../../../../../../../Lib/src/types/FightActionResult";
import { FightStatModifierOperation } from "../../../../../../../Lib/src/types/FightStatModifierOperation";
import { RandomUtils } from "../../../../../../../Lib/src/utils/RandomUtils";
import { PetAssistanceFunc } from "../../../../../data/PetAssistance";
import { FightActionController } from "../../FightActionController";

const use: PetAssistanceFunc = (fighter, _opponent, _turn, _fightController): Promise<PetAssistanceResult | null> => {
	if (RandomUtils.crowniclesRandom.bool(0.60)) {
		return Promise.resolve(null);
	}
	const possibleStatsToBuff: FightStatBuffed[] = [
		FightStatBuffed.ATTACK,
		FightStatBuffed.DEFENSE,
		FightStatBuffed.SPEED
	];
	const statToBuff = RandomUtils.crowniclesRandom.pick(possibleStatsToBuff);

	const result: PetAssistanceResult = {
		assistanceStatus: PetAssistanceState.SUCCESS
	};

	FightActionController.applyBuff(result, {
		selfTarget: true,
		stat: statToBuff,
		operator: FightStatModifierOperation.MULTIPLIER,
		value: 1 + RandomUtils.crowniclesRandom.integer(3, 10) / 100 // random % increase
	}, fighter, undefined);

	return Promise.resolve(result);
};

export default use;
