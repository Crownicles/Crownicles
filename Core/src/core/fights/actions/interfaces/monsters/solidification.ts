import { FightActionFunc } from "../../../../../data/FightAction";
import {
	defaultFightActionResult
} from "../../../../../../../Lib/src/types/FightActionResult";
import { FightActionController } from "../../FightActionController";
import { FightActionType } from "../../../../../../../Lib/src/types/FightActionType";


const use: FightActionFunc = (sender, _receiver, fightAction) => {
	const result = defaultFightActionResult();
	FightActionController.applyResistance(result, {
		origin: fightAction, type: FightActionType.PHYSICAL
	}, sender);

	return {
		...result,
		customMessage: true
	};
};

export default use;
