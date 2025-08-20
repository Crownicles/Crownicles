import { FightActionFunc } from "../../../../../data/FightAction";
import { FightStatBuffed } from "../../../../../../../Lib/src/types/FightActionResult";
import { RandomUtils } from "../../../../../../../Lib/src/utils/RandomUtils";
import { simpleBuffFightAction } from "../../templates/SimpleBuffFightActionTemplate";
import { FightStatModifierOperation } from "../../../../../../../Lib/src/types/FightStatModifierOperation";


const use: FightActionFunc = (sender, _, fightAction) => {
	const randomStat = RandomUtils.crowniclesRandom.pick([
		FightStatBuffed.ATTACK,
		FightStatBuffed.DEFENSE,
		FightStatBuffed.SPEED
	]);

	return {
		...simpleBuffFightAction(sender, {
			selfTarget: true,
			stat: randomStat,
			value: RandomUtils.crowniclesRandom.real(1.1, 1.4),
			operator: FightStatModifierOperation.MULTIPLIER
		}, fightAction),
		customMessage: true
	};
};

export default use;
