import { Fighter } from "../../../fighter/Fighter";
import {
	attackInfo, FightActionController, statsInfo
} from "../../FightActionController";
import { FightAlterations } from "../../FightAlterations";
import { FightActionFunc } from "../../../../../data/FightAction";
import { simpleDamageFightAction } from "../../templates/SimpleDamageFightActionTemplate";
import { FightActionStatus } from "../../../../../../../Lib/src/types/FightActionStatus";
import { RandomUtils } from "../../../../../../../Lib/src/utils/RandomUtils";

const use: FightActionFunc = (sender, receiver) => {
	const result = simpleDamageFightAction(
		{
			sender,
			receiver
		},
		{
			critical: 10,
			failure: 5
		},
		{
			attackInfo: getAttackInfo(receiver),
			statsInfo: getStatsInfo(sender, receiver)
		}
	);

	// 50% chance to apply weak status when prey is below 50% HP
	if (receiver.getEnergy() < receiver.getMaxEnergy() * 0.5
		&& RandomUtils.crowniclesRandom.bool(0.5)) {
		FightActionController.applyAlteration(result, {
			selfTarget: false,
			alteration: FightAlterations.WEAK
		}, receiver);
	}

	return {
		...result,
		customMessage: true
	};
};

export default use;

function getAttackInfo(receiver: Fighter): attackInfo {
	const missingHpRatio = 1 - receiver.getEnergy() / receiver.getMaxEnergy();
	const scaleFactor = 1 + missingHpRatio * 3;

	return {
		minDamage: Math.round(20 * scaleFactor),
		averageDamage: Math.round(40 * scaleFactor),
		maxDamage: Math.round(60 * scaleFactor)
	};
}

function getStatsInfo(sender: Fighter, receiver: Fighter): statsInfo {
	return {
		attackerStats: [
			sender.getAttack(),
			sender.getSpeed()
		],
		defenderStats: [
			receiver.getDefense(),
			receiver.getSpeed() * 0.5
		],
		statsEffect: [
			0.8,
			0.2
		]
	};
}
