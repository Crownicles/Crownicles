import {
	PetAssistanceResult, PetAssistanceState
} from "../../../../../../../Lib/src/types/PetAssistanceResult";
import { PetAssistanceFunc } from "../../../../../data/PetAssistance";
import { FightStatBuffed } from "../../../../../../../Lib/src/types/FightActionResult";
import { RandomUtils } from "../../../../../../../Lib/src/utils/RandomUtils";
import {
	applyGearRemovalBuffs, getRemovableGearStats
} from "../../GearStatRemoval";

const use: PetAssistanceFunc = async (_fighter, opponent, turn, _fightController): Promise<PetAssistanceResult | null> => {
	// Execute at the start of the fight
	if (turn > 2) {
		return null;
	}

	// The removed stats are the ones the weapon adds to the fight, capped by the class
	const weapon = await getRemovableGearStats(opponent, "weapon", "attack");

	// 10% chance to fail to steal the weapon
	if (!weapon || RandomUtils.crowniclesRandom.bool(0.1)) {
		return Promise.resolve({
			assistanceStatus: PetAssistanceState.FAILURE
		});
	}

	const result: PetAssistanceResult = {
		assistanceStatus: PetAssistanceState.SUCCESS
	};

	// Lower the opponent's stats by the share its weapon was providing
	applyGearRemovalBuffs(result, opponent, [
		{
			stat: FightStatBuffed.ATTACK, total: opponent.getAttack(), gear: weapon.attack
		},
		{
			stat: FightStatBuffed.DEFENSE, total: opponent.getDefense(), gear: weapon.defense
		},
		{
			stat: FightStatBuffed.SPEED, total: opponent.getSpeed(), gear: weapon.speed
		}
	]);

	return Promise.resolve(result);
};

export default use;
