import { Fighter } from "../../../fighter/Fighter";
import {
	attackInfo, FightActionController, statsInfo
} from "../../FightActionController";
import { PetAssistanceFunc } from "../../../../../data/PetAssistance";
import {
	PetAssistanceResult, PetAssistanceState
} from "../../../../../../../Lib/src/types/PetAssistanceResult";

function getAttackInfo(): attackInfo {
	return {
		minDamage: 10,
		averageDamage: 50,
		maxDamage: 100
	};
}

function getStatsInfo(_sender: Fighter, receiver: Fighter): statsInfo {
	return {
		attackerStats: [
			100,
			350
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
	// At turn 4 / 5, a warning is given
	if (turn === 4 || turn === 5) {
		return Promise.resolve({
			assistanceStatus: PetAssistanceState.GENERAL_EFFECT
		});
	}

	// At turn 8 / 9, the pet charges
	if (turn === 8 || turn === 9) {
		const result: PetAssistanceResult = {
			damages: FightActionController.getAttackDamage(getStatsInfo(fighter, opponent), fighter, getAttackInfo()),
			assistanceStatus: PetAssistanceState.SUCCESS
		};

		return Promise.resolve(result);
	}

	return null;
};

export default use;
