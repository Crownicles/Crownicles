import {
	PetAssistanceResult, PetAssistanceState
} from "../../../../../../../Lib/src/types/PetAssistanceResult";
import { PetAssistanceFunc } from "../../../../../data/PetAssistance";
import { RealPlayerFighter } from "../../../fighter/RealPlayerFighter";
import { AiPlayerFighter } from "../../../fighter/AiPlayerFighter";
import { PetEntities } from "../../../../database/game/models/PetEntity";
import { PetConstants } from "../../../../../../../Lib/src/constants/PetConstants";
import { RandomUtils } from "../../../../../../../Lib/src/utils/RandomUtils";
import { FightActionController } from "../../FightActionController";
import { FightStatBuffed } from "../../../../../../../Lib/src/types/FightActionResult";
import { FightStatModifierOperation } from "../../../../../../../Lib/src/types/FightStatModifierOperation";

const use: PetAssistanceFunc = async (fighter, opponent, turn, _fightController): Promise<PetAssistanceResult | null> => {
	// Does nothing first turn.
	if (turn <= 2) {
		return null;
	}

	// 85 % of the time, nothing happens
	if (RandomUtils.crowniclesRandom.bool(0.85)) {
		return null;
	}


	if (opponent instanceof RealPlayerFighter || opponent instanceof AiPlayerFighter) {
		// Test if the opponent has a mouse
		const pet = await PetEntities.getById(opponent.player.petId);
		if (pet?.typeId === PetConstants.PETS.MOUSE) {
			return {
				assistanceStatus: PetAssistanceState.AFRAID
			};
		}
	}

	const lastAction = fighter.getLastFightActionUsed();
	if (!lastAction || lastAction.breath === 0) {
		return Promise.resolve({
			assistanceStatus: PetAssistanceState.FAILURE
		});
	}
	const result: PetAssistanceResult = {
		assistanceStatus: PetAssistanceState.SUCCESS
	};

	// Give back to the fighter the amount of breath used by the last action
	FightActionController.applyBuff(result, {
		selfTarget: true,
		stat: FightStatBuffed.BREATH,
		operator: FightStatModifierOperation.ADDITION,
		value: lastAction.breath
	}, fighter, this);

	return Promise.resolve(result);
};

export default use;
