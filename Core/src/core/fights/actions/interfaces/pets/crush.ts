import { Fighter } from "../../../fighter/Fighter";
import {
	attackInfo, FightActionController, statsInfo
} from "../../FightActionController";
import { PetAssistanceFunc } from "../../../../../data/PetAssistance";
import {
	PetAssistanceResult, PetAssistanceState
} from "../../../../../../../Lib/src/types/PetAssistanceResult";
import { FightUtils } from "../../../../utils/FightUtils";
import { PlayerBaseFighter } from "../../../fighter/PlayerBaseFighter";
import { PetDataController } from "../../../../../data/Pet";

function getAttackInfo(): attackInfo {
	return {
		minDamage: 20,
		averageDamage: 225,
		maxDamage: 335
	};
}

function getStatsInfo(sender: PlayerBaseFighter, receiver: Fighter): statsInfo {
	const petId = sender.pet!.typeId;
	const petData = PetDataController.instance.getById(petId)!;
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

// The pet wobbles on turn 9/10, then falls on the opponent on its owner's next turn
const WOBBLE_TURNS = [
	9,
	10
];

const FALL_TURNS = [
	11,
	12
];

const use: PetAssistanceFunc = (fighter, opponent, turn, _fightController): Promise<PetAssistanceResult | null> => {
	if (WOBBLE_TURNS.includes(turn)) {
		return Promise.resolve({
			assistanceStatus: PetAssistanceState.GENERAL_EFFECT
		});
	}

	// On the following turn, the pet falls on the opponent except if the opponent is faster than the threshold
	if (FALL_TURNS.includes(turn)) {
		const petId = fighter.pet!.typeId;
		const petData = PetDataController.instance.getById(petId)!;
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
	return Promise.resolve(null);
};


export default use;
