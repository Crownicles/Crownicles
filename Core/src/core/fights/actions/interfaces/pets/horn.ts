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
		minDamage: 35,
		averageDamage: 70,
		maxDamage: 120
	};
}

function getStatsInfo(sender: Fighter, receiver: Fighter): statsInfo {
	return {
		attackerStats: [
			FightUtils.calculatePetStatFromRawPower(9, sender.level),
			FightUtils.calculatePetStatFromRawPower(2.8, sender.level)
		],
		defenderStats: [
			receiver.getDefense() * 2,
			receiver.getSpeed()
		],
		statsEffect: [
			0.9,
			0.1
		]
	};
}

const use: PetAssistanceFunc = (fighter, opponent, turn, _fightController): Promise<PetAssistanceResult | null> => {
	// At turn 1 / 2, a warning is given
	if (turn === 1 || turn === 2) {
		return Promise.resolve({
			assistanceStatus: PetAssistanceState.GENERAL_EFFECT
		});
	}

	// At turn 3 / 4, the pet hit the opponent
	if (turn === 3 || turn === 4) {
		return Promise.resolve({
			damages: FightActionController.getAttackDamage(getStatsInfo(fighter, opponent), fighter, getAttackInfo(), true),
			assistanceStatus: PetAssistanceState.SUCCESS
		});
	}
	return null;
};

export default use;
