import { Fighter } from "../../../fighter/Fighter";
import {
	attackInfo, FightActionController, statsInfo
} from "../../FightActionController";
import {
	FightActionDataController, FightActionFunc
} from "../../../../../data/FightAction";
import { FightStatBuffed } from "../../../../../../../Lib/src/types/FightActionResult";
import { FightStatModifierOperation } from "../../../../../../../Lib/src/types/FightStatModifierOperation";
import { simpleDamageFightAction } from "../../templates/SimpleDamageFightActionTemplate";
import { FightConstants } from "../../../../../../../Lib/src/constants/FightConstants";

const use: FightActionFunc = (sender, receiver, fightAction) => {
	const result = simpleDamageFightAction(
		{
			sender,
			receiver
		},
		{
			critical: 1,
			failure: 1
		},
		{
			attackInfo: getAttackInfo(),
			statsInfo: getStatsInfo(sender, receiver)
		}
	);

	// Increase defense of the sender by 50 %
	FightActionController.applyBuff(result, {
		selfTarget: true,
		stat: FightStatBuffed.DEFENSE,
		operator: FightStatModifierOperation.MULTIPLIER,
		value: 1.5
	}, sender, fightAction);

	sender.nextFightAction = FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.CHARGING_ATTACK) ?? null;
	return result;
};

export default use;

function getAttackInfo(): attackInfo {
	return {
		minDamage: 15,
		averageDamage: 60,
		maxDamage: 100
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
			receiver.getSpeed()
		],
		statsEffect: [
			0.7,
			0.3
		]
	};
}
