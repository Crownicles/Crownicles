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
		minDamage: 15,
		averageDamage: 65,
		maxDamage: 90
	};
}

function getStatsInfo(sender: Fighter, receiver: Fighter): statsInfo {
	const petId = (sender as PlayerFighter).pet!.typeId;
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
			0.9,
			0.1
		]
	};
}

const use: PetAssistanceFunc = (fighter, opponent, turn, _fightController): Promise<PetAssistanceResult | null> => {
	// At turn 6/7, a warning is given
	if (turn === 6 || turn === 7) {
		return Promise.resolve({
			assistanceStatus: PetAssistanceState.GENERAL_EFFECT
		});
	}

	// At turn 11 / 12, the pet charges
	if (turn === 11 || turn === 12) {
		const result: PetAssistanceResult = {
			damages: FightActionController.getAttackDamage(getStatsInfo(fighter, opponent), fighter, getAttackInfo()),
			assistanceStatus: PetAssistanceState.SUCCESS
		};

		// Stun the opponent
		FightActionController.applyAlteration(result, {
			selfTarget: false,
			alteration: FightAlterations.STUNNED
		}, opponent);

		return Promise.resolve(result);
	}

	return Promise.resolve(null);
};

export default use;
