import {
	PetAssistanceResult, PetAssistanceState
} from "../../../../../../../Lib/src/types/PetAssistanceResult";
import { PetAssistanceFunc } from "../../../../../data/PetAssistance";
import { FightStatBuffed } from "../../../../../../../Lib/src/types/FightActionResult";
import { RandomUtils } from "../../../../../../../Lib/src/utils/RandomUtils";
import {
	applyGearRemovalBuffs, getRemovableGearStats
} from "../../GearStatRemoval";

const use: PetAssistanceFunc = (_fighter, opponent, turn, _fightController): Promise<PetAssistanceResult | null> => {
	// Execute at the start of the fight
	if (turn > 2) {
		return Promise.resolve(null);
	}

	// The removed stats are the ones the armor adds to the fight, enchantments included
	const armor = getRemovableGearStats(opponent, "armor", "defense");

	// 15% chance to fail to break the armor
	if (!armor || RandomUtils.crowniclesRandom.bool(0.15)) {
		return Promise.resolve({
			assistanceStatus: PetAssistanceState.FAILURE
		});
	}

	const result: PetAssistanceResult = {
		assistanceStatus: PetAssistanceState.SUCCESS
	};

	// Lower the opponent's stats by the share its armor was providing
	applyGearRemovalBuffs(result, opponent, [
		{
			stat: FightStatBuffed.DEFENSE, total: opponent.getDefense(), gear: armor.defense
		},
		{
			stat: FightStatBuffed.ATTACK, total: opponent.getAttack(), gear: armor.attack
		},
		{
			stat: FightStatBuffed.SPEED, total: opponent.getSpeed(), gear: armor.speed
		}
	]);

	return Promise.resolve(result);
};

export default use;
