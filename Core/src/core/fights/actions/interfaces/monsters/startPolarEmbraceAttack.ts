import { Fighter } from "../../../fighter/Fighter";
import {
	attackInfo, FightActionController, statsInfo
} from "../../FightActionController";
import {
	FightActionDataController, FightActionFunc
} from "../../../../../data/FightAction";
import { simpleDamageFightAction } from "../../templates/SimpleDamageFightActionTemplate";
import { customMessageActionResult } from "../../../../../../../Lib/src/types/FightActionResult";
import { FightActionType } from "../../../../../../../Lib/src/types/FightActionType";
import { FightConstants } from "../../../../../../../Lib/src/constants/FightConstants";
import { FightAlterations } from "../../FightAlterations";

const use: FightActionFunc = (sender, receiver) => {
	const receiverLastAction = receiver.fightActionsHistory[receiver.fightActionsHistory.length - 1];
	if (receiverLastAction && FightActionType.DISTANCE === receiverLastAction.type) {
		return {
			...customMessageActionResult(),
			damages: 0
		};
	}


	const result = simpleDamageFightAction(
		{
			sender,
			receiver
		},
		{
			critical: 10,
			failure: 0
		},
		{
			attackInfo: getAttackInfo(),
			statsInfo: getStatsInfo(sender, receiver)
		}
	);

	if (Math.random() < 0.2) {
		FightActionController.applyAlteration(result, {
			selfTarget: false,
			alteration: FightAlterations.FROZEN
		}, receiver);
	}

	sender.nextFightAction = FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.MONSTER.IS_STUCK_IN_POLAR_EMBRACE) ?? null;
	return result;
};

export default use;

function getAttackInfo(): attackInfo {
	return {
		minDamage: 25,
		averageDamage: 60,
		maxDamage: 130
	};
}

function getStatsInfo(sender: Fighter, receiver: Fighter): statsInfo {
	return {
		attackerStats: [
			sender.getSpeed(),
			sender.getAttack()
		],
		defenderStats: [
			receiver.getSpeed(),
			receiver.getDefense()
		],
		statsEffect: [
			0.1,
			0.9
		]
	};
}
