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

	// Only players (human or AI) carry a weapon: the stolen stats are the ones it adds to the fight, capped by the class
	const weapon = opponent instanceof PlayerBaseFighter ? await opponent.getEquippedMainItemStats("weapon") : null;

	// 10% chance to fail to steal the weapon
	if (RandomUtils.crowniclesRandom.bool(0.1) || !weapon || weapon.attack === 0) {
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
