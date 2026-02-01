import { FightActionController } from "../../FightActionController";
import { PetAssistanceFunc } from "../../../../../data/PetAssistance";
import {
	PetAssistanceResult, PetAssistanceState
} from "../../../../../../../Lib/src/types/PetAssistanceResult";
import { FightAlterations } from "../../FightAlterations";
import { Fighter } from "../../../fighter/Fighter";

const shouldSkipPetCurse = (turn: number, opponent: Fighter): boolean => {
	return (turn !== 10 && turn !== 11) || opponent.hasFightAlteration();
};

const use: PetAssistanceFunc = (_fighter, opponent, turn, _fightController): Promise<PetAssistanceResult | null> => {
	if (shouldSkipPetCurse(turn, opponent)) {
		return Promise.resolve(null);
	}

	const result: PetAssistanceResult = {
		assistanceStatus: PetAssistanceState.SUCCESS
	};

	FightActionController.applyAlteration(result, {
		selfTarget: false,
		alteration: FightAlterations.CURSED
	}, opponent);

	return Promise.resolve(result);
};

export default use;
