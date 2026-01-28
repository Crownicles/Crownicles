import { Fighter } from "../../fighter/Fighter";
import { FightActionController } from "../FightActionController";
import {
	defaultFightActionResult,
	FightActionResult,
	FightAlterationApplied,
	updateFightActionResultFromSuccessTest
} from "../../../../../../Lib/src/types/FightActionResult";
import { FightConstants } from "../../../../../../Lib/src/constants/FightConstants";

export function simpleAlterationFightAction(target: Fighter, alteration: FightAlterationApplied): FightActionResult {
	const result = defaultFightActionResult();
	FightActionController.applyAlteration(result, alteration, target);
	if (target.alteration?.id === FightConstants.FIGHT_ACTIONS.ALTERATION.CONCENTRATED) {
		result.customMessage = true;
	}
	return updateFightActionResultFromSuccessTest(result, (result.alterations?.length ?? 0) > 0);
}
