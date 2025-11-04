import { FightActionFunc } from "../../../../../data/FightAction";
import {
	defaultFightActionResult, FightStatBuffed
} from "../../../../../../../Lib/src/types/FightActionResult";
import { FightStatModifierOperation } from "../../../../../../../Lib/src/types/FightStatModifierOperation";
import { FightActionController } from "../../FightActionController";


const use: FightActionFunc = (_sender, receiver, fightAction) => {
	const result = defaultFightActionResult();
	const receiverBuffDetails = {
		selfTarget: false,
		stat: FightStatBuffed.DAMAGE_BOOST,
		value: 0.2,
		operator: FightStatModifierOperation.MULTIPLIER,
		duration: 1
	};
	FightActionController.applyBuff(result, receiverBuffDetails, receiver, fightAction);
	return {
		...result,
		customMessage: true
	};
};

export default use;
