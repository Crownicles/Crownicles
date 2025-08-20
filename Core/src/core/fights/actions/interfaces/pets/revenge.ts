import {
	PetAssistanceResult, PetAssistanceState
} from "../../../../../../../Lib/src/types/PetAssistanceResult";
import { PetAssistanceFunc } from "../../../../../data/PetAssistance";
import {
	attackInfo, FightActionController, statsInfo
} from "../../FightActionController";
import { FightActionType } from "../../../../../../../Lib/src/types/FightActionType";
import { Fighter } from "../../../fighter/Fighter";

function getAttackInfo(): attackInfo {
	return {
		minDamage: 3,
		averageDamage: 12,
		maxDamage: 25
	};
}

function getStatsInfo(_sender: Fighter, receiver: Fighter): statsInfo {
	return {
		attackerStats: [
			receiver.getAttack() / 4,
			receiver.getSpeed()
		],
		defenderStats: [
			receiver.getDefense(),
			receiver.getDefense()
		],
		statsEffect: [
			0.5,
			0.5
		]
	};
}

const use: PetAssistanceFunc = (fighter, opponent, turn, _fightController): Promise<PetAssistanceResult | null> => {
	// Does nothing first turn.
	if (turn < 2) {
		return null;
	}

	if (opponent.getLastFightActionUsed()?.type !== FightActionType.PHYSICAL) {
		return null;
	}

	return Promise.resolve({
		damages: FightActionController.getAttackDamage(getStatsInfo(fighter, opponent), fighter, getAttackInfo(), true),
		assistanceStatus: PetAssistanceState.SUCCESS
	});
};

export default use;
