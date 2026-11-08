import { FightActionController } from "../../FightActionController";
import { PetAssistanceFunc } from "../../../../../data/PetAssistance";
import {
	PetAssistanceResult, PetAssistanceState
} from "../../../../../../../Lib/src/types/PetAssistanceResult";
import { FightAlterations } from "../../FightAlterations";
import { Fighter } from "../../../fighter/Fighter";
import { PlayerFighter } from "../../../fighter/PlayerFighter";
import { AiPlayerFighter } from "../../../fighter/AiPlayerFighter";
import { ClassConstants } from "../../../../../../../Lib/src/constants/ClassConstants";
import { FightConstants } from "../../../../../../../Lib/src/constants/FightConstants";

/*
 * Turns (within each MAX_TURNS cycle, so it repeats in overtime) on which the pet tries to petrify.
 * Each pair covers both turn parities, the owner plays on exactly one of them.
 */
const PETRIFICATION_TURNS = [
	2,
	3,
	14,
	15
];

const shouldSkipPetPetrified = (turn: number, opponent: Fighter): boolean => !PETRIFICATION_TURNS.includes(turn % FightConstants.MAX_TURNS) || opponent.hasFightAlteration();

const use: PetAssistanceFunc = (_fighter, opponent, turn, _fightController): Promise<PetAssistanceResult | null> => {
	if (shouldSkipPetPetrified(turn, opponent)) {
		return Promise.resolve(null);
	}

	// Check if opponent is a mage - petrification doesn't work on mages
	if ((opponent instanceof PlayerFighter || opponent instanceof AiPlayerFighter)
		&& opponent.player.class === ClassConstants.CLASSES_ID.MYSTIC_MAGE) {
		return Promise.resolve({
			assistanceStatus: PetAssistanceState.FAILURE
		});
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
