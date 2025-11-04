import { FightActionFunc } from "../../../../../data/FightAction";
import { FightStatBuffed } from "../../../../../../../Lib/src/types/FightActionResult";
import { FightStatModifierOperation } from "../../../../../../../Lib/src/types/FightStatModifierOperation";
import { simpleBuffFightAction } from "../../templates/SimpleBuffFightActionTemplate";

const use: FightActionFunc = (_sender, receiver, fightAction) => ({
	...simpleBuffFightAction(receiver, {
		selfTarget: false,
		stat: FightStatBuffed.DAMAGE_BOOST,
		value: 0.5,
		operator: FightStatModifierOperation.MULTIPLIER,
		duration: 1
	}, fightAction),
	customMessage: true
});

export default use;
