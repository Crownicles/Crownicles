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
		minDamage: 50,
		averageDamage: 130,
		maxDamage: 220
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

const use: PetAssistanceFunc = (fighter, opponent, turn, _fightController): Promise<PetAssistanceResult | null> => {
	if (turn <= 2) {
		return Promise.resolve({
			assistanceStatus: PetAssistanceState.GENERAL_EFFECT
		});
	}

	// On turn 23/24, bomb explodes if opponent's energy >= fighter's; otherwise, it fails.
	if (turn === 23 || turn === 24) {
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
