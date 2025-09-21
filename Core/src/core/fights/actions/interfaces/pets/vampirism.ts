import {
	PetAssistanceResult, PetAssistanceState
} from "../../../../../../../Lib/src/types/PetAssistanceResult";
import { PetAssistanceFunc } from "../../../../../data/PetAssistance";
import {
	attackInfo, FightActionController, statsInfo
} from "../../FightActionController";
import { Fighter } from "../../../fighter/Fighter";
import { FightStatBuffed } from "../../../../../../../Lib/src/types/FightActionResult";
import { FightStatModifierOperation } from "../../../../../../../Lib/src/types/FightStatModifierOperation";
import { RandomUtils } from "../../../../../../../Lib/src/utils/RandomUtils";
import { FightUtils } from "../../../../utils/FightUtils";

function getAttackInfo(): attackInfo {
	return {
		minDamage: 3,
		averageDamage: 12,
		maxDamage: 25
	};
}

function getStatsInfo(sender: Fighter, receiver: Fighter): statsInfo {
	return {
		attackerStats: [
			FightUtils.calculatePetStatFromRawPower(0.9, sender.level),
			FightUtils.calculatePetStatFromRawPower(0.8, sender.level)
		],
		defenderStats: [
			0,
			receiver.getDefense()
		],
		statsEffect: [
			0.5,
			0.5
		]
	};
}

const use: PetAssistanceFunc = (fighter, opponent, _turn, _fightController): Promise<PetAssistanceResult | null> => {
	// 75% chance of doing nothing
	if (RandomUtils.crowniclesRandom.bool(0.75)) {
		return Promise.resolve(null);
	}

	const damages = FightActionController.getAttackDamage(getStatsInfo(fighter, opponent), fighter, getAttackInfo(), true);
	const result: PetAssistanceResult = {
		damages,
		assistanceStatus: PetAssistanceState.SUCCESS
	};

	FightActionController.applyBuff(result, {
		selfTarget: true,
		stat: FightStatBuffed.ENERGY,
		operator: FightStatModifierOperation.ADDITION,
		value: damages
	}, fighter, this);

	return Promise.resolve(result);
};

export default use;
