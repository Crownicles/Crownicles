import { FightActionController } from "../../FightActionController";
import { PetAssistanceFunc } from "../../../../../data/PetAssistance";
import {
	PetAssistanceResult, PetAssistanceState
} from "../../../../../../../Lib/src/types/PetAssistanceResult";
import { FightAlterations } from "../../FightAlterations";
import { FightStatBuffed } from "../../../../../../../Lib/src/types/FightActionResult";
import { FightStatModifierOperation } from "../../../../../../../Lib/src/types/FightStatModifierOperation";
import { RandomUtils } from "../../../../../../../Lib/src/utils/RandomUtils";
import { Fighter } from "../../../fighter/Fighter";
import { PlayerFighter } from "../../../fighter/PlayerFighter";
import { AiPlayerFighter } from "../../../fighter/AiPlayerFighter";
import { ClassConstants } from "../../../../../../../Lib/src/constants/ClassConstants";

function makeBleed(opponent: Fighter, result: PetAssistanceResult): void {
	// Make bleed the opponent
	FightActionController.applyAlteration(result, {
		selfTarget: false,
		alteration: FightAlterations.BLEEDING
	}, opponent);
}

const use: PetAssistanceFunc = (fighter, opponent, turn, _fightController): Promise<PetAssistanceResult | null> => {
	if (![
		3,
		4,
		19,
		20
	].includes(turn)) {
		return null;
	}

	// Check if opponent is a paladin (paladins are immune to vampires)
	if ((opponent instanceof PlayerFighter || opponent instanceof AiPlayerFighter)
		&& (opponent.player.class === ClassConstants.CLASSES_ID.PALADIN
			|| opponent.player.class === ClassConstants.CLASSES_ID.LUMINOUS_PALADIN)) {
		return Promise.resolve({
			assistanceStatus: PetAssistanceState.FAILURE
		});
	}

	const result: PetAssistanceResult = {
		assistanceStatus: PetAssistanceState.SUCCESS
	};

	if (!opponent.hasFightAlteration()) {
		makeBleed(opponent, result);
	}

	const pointsToHealFighter = fighter.getMaxEnergy() - fighter.getEnergy();

	if (pointsToHealFighter > 0 && opponent.hasFightAlteration() && opponent.alteration.id === FightAlterations.BLEEDING) {
		FightActionController.applyBuff(result, {
			selfTarget: true,
			stat: FightStatBuffed.ENERGY,
			operator: FightStatModifierOperation.ADDITION,
			value: RandomUtils.crowniclesRandom.integer(5, Math.max(fighter.getMaxEnergy() * 0.03, 15))
		}, fighter, this);
	}

	return Promise.resolve(result);
};

export default use;
