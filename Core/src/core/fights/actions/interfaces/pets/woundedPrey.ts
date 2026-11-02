import {
	attackInfo, FightActionController, statsInfo
} from "../../FightActionController";
import { PetAssistanceFunc } from "../../../../../data/PetAssistance";
import {
	PetAssistanceResult, PetAssistanceState
} from "../../../../../../../Lib/src/types/PetAssistanceResult";
import { Fighter } from "../../../fighter/Fighter";
import { FightUtils } from "../../../../utils/FightUtils";

/**
 * Share of its max energy under which the opponent becomes a wounded prey
 */
const WOUNDED_PREY_ENERGY_RATIO = 0.15;

// Owners whose eagle already dove, the dive only happens once per fight
const divedOwners = new WeakSet<Fighter>();

/**
 * Around 220 damage at level 100, close to 15% of the max energy of a level 100 player:
 * the dive usually finishes the prey but can leave it barely alive
 */
function getAttackInfo(): attackInfo {
	return {
		minDamage: 40,
		averageDamage: 100,
		maxDamage: 150
	};
}

// The dive relies on the eagle's speed against the prey's reactivity, its force is too low to matter
function getStatsInfo(sender: Fighter, receiver: Fighter): statsInfo {
	return {
		attackerStats: [FightUtils.getPetFightStats(sender).speed],
		defenderStats: [receiver.getSpeed()],
		statsEffect: [1]
	};
}

const use: PetAssistanceFunc = (fighter, opponent, _turn, _fightController): Promise<PetAssistanceResult | null> => {
	if (divedOwners.has(fighter) || opponent.getEnergy() >= opponent.getMaxEnergy() * WOUNDED_PREY_ENERGY_RATIO) {
		return Promise.resolve(null);
	}

	divedOwners.add(fighter);
	return Promise.resolve({
		damages: FightActionController.getAttackDamage(getStatsInfo(fighter, opponent), fighter, getAttackInfo(), true),
		assistanceStatus: PetAssistanceState.SUCCESS
	});
};

export default use;
