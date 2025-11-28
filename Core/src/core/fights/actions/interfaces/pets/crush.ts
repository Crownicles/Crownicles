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
		minDamage: 10,
		averageDamage: 150,
		maxDamage: 235
	};
}

function getStatsInfo(sender: Fighter, receiver: Fighter): statsInfo {
	const petId = (sender as PlayerFighter).pet.typeId;
	const petData = PetDataController.instance.getById(petId);
	return {
		attackerStats: [
			FightUtils.calculatePetStatFromForce(petData.force, sender.level),
			FightUtils.calculatePetStatFromSpeed(petData.speed, sender.level)
		],
		defenderStats: [
			receiver.getDefense(),
			receiver.getSpeed()
		],
		statsEffect: [
			0.85,
			0.15
		]
	};
}

const use: PetAssistanceFunc = (fighter, opponent, turn, _fightController): Promise<PetAssistanceResult | null> => {
	// At turn 13/14, a warning is given
	if (turn === 13 || turn === 14) {
		return Promise.resolve({
			assistanceStatus: PetAssistanceState.GENERAL_EFFECT
		});
	}

	// On the following turn, the pet falls on the opponent except if the opponent is faster than the threshold
	if (turn === 15 || turn === 16) {
		const petId = (fighter as PlayerFighter).pet.typeId;
		const petData = PetDataController.instance.getById(petId);
		const centerSpeed = FightUtils.calculatePetStatFromForce(petData.force * 0.75, fighter.level);
		const startSpeed = FightUtils.calculatePetStatFromForce(petData.force * 0.5, fighter.level);
		const denominator = centerSpeed - startSpeed;
		const damageMultiplier = Math.abs(denominator) < Number.EPSILON
			? 0
			: 0.5 - 0.5 * Math.tanh((opponent.getSpeed() - centerSpeed) / denominator);

		const damages = Math.round(FightActionController.getAttackDamage(getStatsInfo(fighter, opponent), fighter, getAttackInfo(), true) * damageMultiplier);

		// If the damages are below a certain threshold, the pet attack fails
		if (damages < 30) {
			return Promise.resolve({
				assistanceStatus: PetAssistanceState.FAILURE
			});
		}

		const result: PetAssistanceResult = {
			damages,
			assistanceStatus: PetAssistanceState.SUCCESS
		};

		return Promise.resolve(result);
	}
	return null;
};


export default use;
