import { Fighter } from "../../../fighter/Fighter";
import {
	attackInfo, FightActionController, statsInfo
} from "../../FightActionController";
import { PetAssistanceFunc } from "../../../../../data/PetAssistance";
import {
	PetAssistanceResult, PetAssistanceState
} from "../../../../../../../Lib/src/types/PetAssistanceResult";
import { RandomUtils } from "../../../../../../../Lib/src/utils/RandomUtils";
import { FightUtils } from "../../../../utils/FightUtils";

function getAttackInfo(): attackInfo {
	return {
		minDamage: 1,
		averageDamage: 2,
		maxDamage: 3
	};
}

function getStatsInfo(sender: Fighter, receiver: Fighter): statsInfo {
	return {
		attackerStats: [
			FightUtils.calculatePetStatFromRawPower(0.1, sender.level),
			FightUtils.calculatePetStatFromRawPower(0.2, sender.level)
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

const use: PetAssistanceFunc = (fighter, opponent, _turn, _fightController): Promise<PetAssistanceResult | null> => {
	// 90% chance of doing nothing
	if (RandomUtils.crowniclesRandom.bool(0.9)) {
		return null;
	}
	return Promise.resolve({
		damages: FightActionController.getAttackDamage(getStatsInfo(fighter, opponent), fighter, getAttackInfo()),
		assistanceStatus: PetAssistanceState.SUCCESS
	});
};

export default use;
