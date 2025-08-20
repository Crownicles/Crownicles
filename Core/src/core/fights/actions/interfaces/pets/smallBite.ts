import { Fighter } from "../../../fighter/Fighter";
import {
	attackInfo, FightActionController, statsInfo
} from "../../FightActionController";
import { PetAssistanceFunc } from "../../../../../data/PetAssistance";
import {
	PetAssistanceResult, PetAssistanceState
} from "../../../../../../../Lib/src/types/PetAssistanceResult";
import { RandomUtils } from "../../../../../../../Lib/src/utils/RandomUtils";
import { FightAlterations } from "../../FightAlterations";

function getAttackInfo(): attackInfo {
	return {
		minDamage: 5,
		averageDamage: 15,
		maxDamage: 50
	};
}

function getStatsInfo(_sender: Fighter, receiver: Fighter): statsInfo {
	return {
		attackerStats: [
			50,
			140
		],
		defenderStats: [
			receiver.getDefense(),
			receiver.getSpeed()
		],
		statsEffect: [
			0.8,
			0.2
		]
	};
}

const use: PetAssistanceFunc = (fighter, opponent, turn, _fightController): Promise<PetAssistanceResult | null> => {
	// Attack every 9 turns
	if (!(turn % 9 === 7 || turn % 9 === 8)) {
		return null;
	}

	const result: PetAssistanceResult = {
		damages: FightActionController.getAttackDamage(getStatsInfo(fighter, opponent), fighter, getAttackInfo(), true),
		assistanceStatus: PetAssistanceState.SUCCESS
	};

	if (RandomUtils.crowniclesRandom.bool(0.4) && !opponent.hasFightAlteration()) {
		FightActionController.applyAlteration(result, {
			selfTarget: false,
			alteration: FightAlterations.POISONED
		}, opponent);
	}

	return Promise.resolve(result);
};


export default use;
