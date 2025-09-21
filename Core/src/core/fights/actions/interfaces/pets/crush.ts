import { Fighter } from "../../../fighter/Fighter";
import {
	attackInfo, FightActionController, statsInfo
} from "../../FightActionController";
import { PetAssistanceFunc } from "../../../../../data/PetAssistance";
import {
	PetAssistanceResult, PetAssistanceState
} from "../../../../../../../Lib/src/types/PetAssistanceResult";
import { FightUtils } from "../../../../utils/FightUtils";

function getAttackInfo(): attackInfo {
	return {
		minDamage: 10,
		averageDamage: 150,
		maxDamage: 280
	};
}

function getStatsInfo(sender: Fighter, receiver: Fighter): statsInfo {
	return {
		attackerStats: [
			FightUtils.calculatePetStatFromRawPower(8, sender.level),
			FightUtils.calculatePetStatFromRawPower(0.5, sender.level)
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
		if (opponent.getSpeed() > FightUtils.calculatePetStatFromRawPower(3.85, fighter.level)) {
			return Promise.resolve({
				assistanceStatus: PetAssistanceState.FAILURE
			});
		}
		const result: PetAssistanceResult = {
			damages: FightActionController.getAttackDamage(getStatsInfo(fighter, opponent), fighter, getAttackInfo(), true),
			assistanceStatus: PetAssistanceState.SUCCESS
		};

		return Promise.resolve(result);
	}
	return null;
};


export default use;
