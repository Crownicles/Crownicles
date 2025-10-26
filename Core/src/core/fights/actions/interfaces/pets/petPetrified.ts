import { FightActionController } from "../../FightActionController";
import { PetAssistanceFunc } from "../../../../../data/PetAssistance";
import {
	PetAssistanceResult, PetAssistanceState
} from "../../../../../../../Lib/src/types/PetAssistanceResult";
import { FightAlterations } from "../../FightAlterations";
import { Fighter } from "../../../fighter/Fighter";

const shouldSkipPetPetrified = (turn: number, opponent: Fighter): boolean => {
	return (turn !== 17 && turn !== 18) || opponent.hasFightAlteration();
};

const use: PetAssistanceFunc = (_fighter, opponent, turn, _fightController): Promise<PetAssistanceResult | null> => {
	if (shouldSkipPetPetrified(turn, opponent)) {
		return null;
	}

	const result: PetAssistanceResult = {
		assistanceStatus: PetAssistanceState.SUCCESS
	};

	FightActionController.applyAlteration(result, {
		selfTarget: false,
		alteration: FightAlterations.PETRIFIED
	}, opponent);

	return Promise.resolve(result);
};

export default use;
