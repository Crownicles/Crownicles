import { Fighter } from "../../../fighter/Fighter";
import {
	attackInfo, FightActionController, statsInfo
} from "../../FightActionController";
import { FightActionFunc } from "../../../../../data/FightAction";
import { simpleDamageFightAction } from "../../templates/SimpleDamageFightActionTemplate";
import { FightAlterations } from "../../FightAlterations";
import { FightStatBuffed } from "../../../../../../../Lib/src/types/FightActionResult";
import { FightStatModifierOperation } from "../../../../../../../Lib/src/types/FightStatModifierOperation";

const use: FightActionFunc = (sender, receiver, fightAction) => {
	const result = simpleDamageFightAction(
		{
			sender,
			receiver
		},
		{
			critical: 20,
			failure: 8
		},
		{
			attackInfo: getAttackInfo(),
			statsInfo: getStatsInfo(sender, receiver)
		}
	);

	// If the opponent has an alteration, give back 2 of breath to the sender
	if (receiver.hasFightAlteration() && receiver.alteration.id !== FightAlterations.BLIND) {
		FightActionController.applyBuff(result, {
			selfTarget: true,
			stat: FightStatBuffed.BREATH,
			operator: FightStatModifierOperation.ADDITION,
			value: 3
		}, sender, fightAction);
	}

	FightActionController.applyAlteration(result, {
		selfTarget: false,
		alteration: FightAlterations.BLIND
	}, receiver);

	return result;
};

export default use;

function getAttackInfo(): attackInfo {
	return {
		minDamage: 40,
		averageDamage: 60,
		maxDamage: 130
	};
}

function getStatsInfo(sender: Fighter, receiver: Fighter): statsInfo {
	return {
		attackerStats: [
			sender.getAttack(),
			receiver.getAttack()
		],
		defenderStats: [
			receiver.getDefense() * 0.15,
			receiver.getDefense() * 0.05
		],
		statsEffect: [
			0.5,
			0.5
		]
	};
}
