import { Fighter } from "../../../fighter/Fighter";
import {
	attackInfo, FightActionController, statsInfo
} from "../../FightActionController";
import { PetAssistanceFunc } from "../../../../../data/PetAssistance";
import {
	PetAssistanceResult, PetAssistanceState
} from "../../../../../../../Lib/src/types/PetAssistanceResult";
import { FightAlterations } from "../../FightAlterations";
import { FightUtils } from "../../../../utils/FightUtils";
import { PlayerFighter } from "../../../fighter/PlayerFighter";
import { PetDataController } from "../../../../../data/Pet";

function getAttackInfo(): attackInfo {
	return {
		minDamage: 10,
		averageDamage: 35,
		maxDamage: 45
	};
}

function getStatsInfo(sender: Fighter, receiver: Fighter): statsInfo {
	const petId = (sender as PlayerFighter).pet.typeId;
	const force = PetDataController.instance.getById(petId).force;
	return {
		attackerStats: [
			FightUtils.calculatePetStatFromForce(force, sender.level),
			FightUtils.calculatePetStatFromForce(force, sender.level)
		],
		defenderStats: [
			receiver.getDefense(),
			receiver.getSpeed()
		],
		statsEffect: [
			0.9,
			0.1
		]
	};
}

const use: PetAssistanceFunc = (fighter, opponent, turn, _fightController): Promise<PetAssistanceResult | null> => {
	// send warning at the beginning of the fight
	if (turn <= 2) {
		return Promise.resolve({
			assistanceStatus: PetAssistanceState.GENERAL_EFFECT
		});
	}

	// Will execute the attack on turn 12 or 13
	if (turn !== 12 && turn !== 13) {
		return null;
	}

	const result: PetAssistanceResult = {
		damages: FightActionController.getAttackDamage(getStatsInfo(fighter, opponent), fighter, getAttackInfo(), true),
		assistanceStatus: PetAssistanceState.SUCCESS
	};

	// Make the opponent poisoned
	FightActionController.applyAlteration(result, {
		selfTarget: false,
		alteration: FightAlterations.POISONED
	}, opponent);

	return Promise.resolve(result);
};


export default use;
