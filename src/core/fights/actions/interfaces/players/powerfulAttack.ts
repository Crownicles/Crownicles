import {Fighter} from "../../../fighter/Fighter";
import {attackInfo, FightActionController, statsInfo} from "../../FightActionController";
import {FightAlterations} from "../../FightAlterations";
import {FightActionFunc} from "@Core/src/data/FightAction";
import {FightActionResult, FightStatBuffed} from "@Lib/src/interfaces/FightActionResult";
import {FightStatModifierOperation} from "@Lib/src/interfaces/FightStatModifierOperation";

const use: FightActionFunc = (sender, receiver, fightAction) => {
	const initialDamage = FightActionController.getAttackDamage(getStatsInfo(sender, receiver), sender, getAttackInfo());
	const damageDealt = FightActionController.applySecondaryEffects(initialDamage, 5, 20);

	// Check how many times the attack appears in the fight action history of the sender
	const count = sender.fightActionsHistory.filter(action => action.id === "powerfulAttack").length;

	// If the attack is repeated more than 3 times, the damage dealt is reduced by 70%
	const result: FightActionResult = {
		attackStatus: damageDealt.status,
		damages: damageDealt.damages * (count > 3 ? 0.3 : 1)
	};

	// 20% chance to stun the sender and deal 50% more damage
	if (Math.random() < 0.2) {
		FightActionController.applyAlteration(result, {
			selfTarget: true,
			alteration: FightAlterations.STUNNED
		}, sender);
		if (result.alterations) {
			result.damages *= 1.5;
		}
	}

	result.damages = Math.round(result.damages);

	// Reduce speed of the sender by 15 %
	FightActionController.applyBuff(result, {
		selfTarget: true,
		stat: FightStatBuffed.SPEED,
		operator: FightStatModifierOperation.MULTIPLIER,
		value: 0.85
	}, sender, fightAction);

	return result;
};

export default use;

function getAttackInfo(): attackInfo {
	return {
		minDamage: 50,
		averageDamage: 150,
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
			receiver.getDefense(),
			receiver.getSpeed()
		],
		statsEffect: [
			0.7,
			0.3
		]
	};
}
