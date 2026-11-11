import {
	PetAssistanceResult, PetAssistanceState
} from "../../../../../../../Lib/src/types/PetAssistanceResult";
import { PetAssistanceFunc } from "../../../../../data/PetAssistance";
import { FightStatBuffed } from "../../../../../../../Lib/src/types/FightActionResult";
import { RandomUtils } from "../../../../../../../Lib/src/utils/RandomUtils";
import { PlayerBaseFighter } from "../../../fighter/PlayerBaseFighter";
import { applyGearRemovalBuffs } from "../../GearStatRemoval";

const use: PetAssistanceFunc = async (_fighter, opponent, turn, _fightController): Promise<PetAssistanceResult | null> => {
	// Execute at the start of the fight
	if (turn > 2) {
		return null;
	}

	// Only players (human or AI) wear an armor: the broken stats are the ones it adds to the fight, capped by the class
	const armor = opponent instanceof PlayerBaseFighter ? await opponent.getEquippedMainItemStats("armor") : null;

	// 15% chance to fail to break the armor
	if (RandomUtils.crowniclesRandom.bool(0.15) || !armor || armor.defense === 0) {
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
