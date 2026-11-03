import { Fighter } from "../../../fighter/Fighter";
import {
	attackInfo, FightActionController, statsInfo
} from "../../FightActionController";
import { PetAssistanceFunc } from "../../../../../data/PetAssistance";
import {
	PetAssistanceResult, PetAssistanceState
} from "../../../../../../../Lib/src/types/PetAssistanceResult";
import { FightUtils } from "../../../../utils/FightUtils";
import { PlayerFighter } from "../../../fighter/PlayerFighter";
import { PetDataController } from "../../../../../data/Pet";

function getAttackInfo(): attackInfo {
	return {
		minDamage: 55,
		averageDamage: 150,
		maxDamage: 250
	};
}

function getStatsInfo(sender: Fighter, receiver: Fighter): statsInfo {
	const petId = (sender as PlayerFighter).pet!.typeId;
	const force = PetDataController.instance.getById(petId)!.force;
	return {
		attackerStats: [FightUtils.calculatePetStatFromForce(force, sender.level)],
		defenderStats: [receiver.getDefense()],
		statsEffect: [1]
	};
}

// Mid-fight: before, the bomb exploded on turn 23/24, after the end of most fights
const EXPLOSION_TURNS = [
	13,
	14
];

const use: PetAssistanceFunc = (fighter, opponent, turn, _fightController): Promise<PetAssistanceResult | null> => {
	if (turn <= 2) {
		return Promise.resolve({
			assistanceStatus: PetAssistanceState.GENERAL_EFFECT
		});
	}

	// The bomb explodes if the opponent's energy >= fighter's; otherwise, it fails.
	if (EXPLOSION_TURNS.includes(turn)) {
		if (opponent.getEnergy() < fighter.getEnergy()) {
			return Promise.resolve({
				assistanceStatus: PetAssistanceState.FAILURE
			});
		}
		return Promise.resolve({
			damages: FightActionController.getAttackDamage(getStatsInfo(fighter, opponent), fighter, getAttackInfo(), true),
			assistanceStatus: PetAssistanceState.SUCCESS
		});
	}
	return Promise.resolve(null);
};

export default use;
