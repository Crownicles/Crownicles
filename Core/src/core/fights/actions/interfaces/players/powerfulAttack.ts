import { Fighter } from "../../../fighter/Fighter";
import {
	attackInfo, FightActionController, statsInfo
} from "../../FightActionController";
import { FightAlterations } from "../../FightAlterations";
import { FightActionFunc } from "../../../../../data/FightAction";
import {
	FightActionResult, FightStatBuffed
} from "../../../../../../../Lib/src/types/FightActionResult";
import { FightStatModifierOperation } from "../../../../../../../Lib/src/types/FightStatModifierOperation";
import { MathUtils } from "../../../../utils/MathUtils";

const use: FightActionFunc = (sender, receiver, fightAction) => {
	const initialDamage = FightActionController.getAttackDamage(getStatsInfo(sender, receiver), sender, getAttackInfo());
	const damageDealt = FightActionController.applySecondaryEffects(
		initialDamage,
		0,
		MathUtils.getIntervalValue(2, 12, MathUtils.clamp((130 - sender.level) / 40, 0, 1))
	);

	/*
	 * Check how many times the attack appears in the fight action history of the sender
	 * + 1 to count the current attack
	 */
	const count = sender.fightActionsHistory.filter(action => action.id === "powerfulAttack").length + 1;

	// If the attack is repeated more than 3 times, the damage dealt is reduced by 90%
	const result: FightActionResult = {
		attackStatus: damageDealt.status,
		damages: damageDealt.damages * (count > 3 ? 0.1 : 1)
	};

	// 20% chance to stun the sender and deal 50% more damage
	if (Math.random() < 0.2) {
		FightActionController.applyAlteration(result, {
			selfTarget: true,
			alteration: FightAlterations.STUNNED
		}, sender);
		if (result.alterations) {
			result.damages! *= 1.5;
		}
	}

	result.damages = Math.round(result.damages!);

	// Reduce the speed of the opponent by 15 %
	FightActionController.applyBuff(result, {
		selfTarget: false,
		stat: FightStatBuffed.SPEED,
		operator: FightStatModifierOperation.MULTIPLIER,
		value: 0.85
	}, receiver, fightAction!);

	return result;
};

export default use;

function getAttackInfo(): attackInfo {
	return {
		minDamage: 50,
		averageDamage: 180,
		maxDamage: 280
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
