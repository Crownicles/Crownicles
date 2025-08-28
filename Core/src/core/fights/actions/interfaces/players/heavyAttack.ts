import { Fighter } from "../../../fighter/Fighter";
import {
	attackInfo, FightActionController, statsInfo
} from "../../FightActionController";
import { FightActionFunc } from "../../../../../data/FightAction";
import { FightStatBuffed } from "../../../../../../../Lib/src/types/FightActionResult";
import { FightStatModifierOperation } from "../../../../../../../Lib/src/types/FightStatModifierOperation";
import { FightConstants } from "../../../../../../../Lib/src/constants/FightConstants";

const use: FightActionFunc = (sender, receiver, fightAction) => {
	const initialDamage = FightActionController.getAttackDamage(getStatsInfo(sender, receiver), sender, getAttackInfo());
	const damageDealt = FightActionController.applySecondaryEffects(initialDamage, 5, 8);

	// This attack will do less damage if the player's last action was not resting
	const lastFightAction = sender.getLastFightActionUsed();
	if (!lastFightAction || lastFightAction.id !== FightConstants.FIGHT_ACTIONS.PLAYER.RESTING) {
		damageDealt.damages = Math.round(damageDealt.damages * 0.53);
	}

	const result = {
		attackStatus: damageDealt.status,
		damages: damageDealt.damages
	};

	// Count how many times this attack has been used by checking the history
	const heavyAttackUsageCount = sender.fightActionsHistory.filter(action =>
		action.id === FightConstants.FIGHT_ACTIONS.PLAYER.HEAVY_ATTACK).length;

	// Apply defense reduction based on usage count (0.8, 0.9, 0.95, then 1.0)
	const defenseMultipliers = [
		0.8,
		0.9,
		0.95,
		1.0
	];
	const defenseMultiplier = defenseMultipliers[Math.min(heavyAttackUsageCount, 3)];

	if (defenseMultiplier < 1.0) {
		FightActionController.applyBuff(result, {
			selfTarget: false,
			stat: FightStatBuffed.DEFENSE,
			operator: FightStatModifierOperation.MULTIPLIER,
			value: defenseMultiplier
		}, receiver, fightAction);
	}

	return result;
};

export default use;

function getAttackInfo(): attackInfo {
	return {
		minDamage: 60,
		averageDamage: 180,
		maxDamage: 250
	};
}

function getStatsInfo(sender: Fighter, receiver: Fighter): statsInfo {
	return {
		attackerStats: [
			sender.getAttack(),
			sender.getSpeed()
		],
		defenderStats: [
			receiver.getDefense() * 0.5,
			receiver.getSpeed() * 1.5
		],
		statsEffect: [
			0.6,
			0.4
		]
	};
}
