import { Fighter } from "../../../fighter/Fighter";
import {
	attackInfo, FightActionController, statsInfo
} from "../../FightActionController";
import { FightAlterations } from "../../FightAlterations";
import { FightActionFunc } from "../../../../../data/FightAction";
import { simpleDamageFightAction } from "../../templates/SimpleDamageFightActionTemplate";
import { FightStatBuffed } from "../../../../../../../Lib/src/types/FightActionResult";
import { FightStatModifierOperation } from "../../../../../../../Lib/src/types/FightStatModifierOperation";

const use: FightActionFunc = (sender, receiver, fightAction) => {
	const result = simpleDamageFightAction(
		{
			sender,
			receiver
		},
		{
			critical: 5,
			failure: 0
		},
		{
			attackInfo: getAttackInfo(),
			statsInfo: getStatsInfo(sender, receiver)
		}
	);

	// If the opponent has more than 40% of life, this attack will heal the sender
	const recoveredEnergy = Math.round(result.damages! * (receiver.getEnergy() - receiver.getMaxEnergy() * 0.3) / receiver.getMaxEnergy());
	if (receiver.getEnergy() > receiver.getMaxEnergy() * 0.4) {
		FightActionController.applyBuff(result, {
			selfTarget: true,
			stat: FightStatBuffed.ENERGY,
			operator: FightStatModifierOperation.ADDITION,
			value: recoveredEnergy
		}, sender, fightAction);
	}

	FightActionController.applyAlteration(result, {
		selfTarget: false,
		alteration: FightAlterations.CURSED
	}, receiver);

	return result;
};

export default use;

function getAttackInfo(): attackInfo {
	return {
		minDamage: 60,
		averageDamage: 95,
		maxDamage: 135
	};
}

function getStatsInfo(sender: Fighter, receiver: Fighter): statsInfo {
	return {
		attackerStats: [sender.getAttack()],
		defenderStats: [receiver.getDefense()],
		statsEffect: [1]
	};
}
