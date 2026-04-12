import { FightActionFunc } from "../../../../../data/FightAction";
import { defaultFightActionResult } from "../../../../../../../Lib/src/types/FightActionResult";
import { FightActionController } from "../../FightActionController";
import { FightActionType } from "../../../../../../../Lib/src/types/FightActionType";


const use: FightActionFunc = (sender, _receiver, _fightAction) => {
	const result = defaultFightActionResult();

	// Physical attacks are reflected (70% resistance + reflect)
	FightActionController.applyResistance(result, {
		selfTarget: true,
		type: FightActionType.PHYSICAL,
		value: 0.7,
		duration: 1,
		reflectDamage: true
	}, sender);

	// Distance attacks are absorbed by the shell (40% resistance, no reflect)
	FightActionController.applyResistance(result, {
		selfTarget: true,
		type: FightActionType.DISTANCE,
		value: 0.4,
		duration: 1,
		reflectDamage: false
	}, sender);
	return {
		...result,
		customMessage: true
	};
};

export default use;
