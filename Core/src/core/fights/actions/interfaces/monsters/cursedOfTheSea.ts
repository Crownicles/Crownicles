import {
	FightActionController
} from "../../FightActionController";
import { FightAlterations } from "../../FightAlterations";
import { FightActionFunc } from "../../../../../data/FightAction";
import { customMessageActionResult } from "../../../../../../../Lib/src/types/FightActionResult";

const use: FightActionFunc = (_sender, receiver, _fightAction) => {
	const result = customMessageActionResult();

	FightActionController.applyAlteration(result, {
		selfTarget: false,
		alteration: FightAlterations.CURSED_BY_THE_SEA
	}, receiver);

	return result;
};

export default use;

