import { Fighter } from "../../../fighter/Fighter";
import {
	attackInfo, FightActionController, statsInfo
} from "../../FightActionController";
import { FightActionFunc } from "../../../../../data/FightAction";
import { FightStatBuffed } from "../../../../../../../Lib/src/types/FightActionResult";
import { FightStatModifierOperation } from "../../../../../../../Lib/src/types/FightStatModifierOperation";
import { simpleDamageFightAction } from "../../templates/SimpleDamageFightActionTemplate";
import { FightConstants } from "../../../../../../../Lib/src/constants/FightConstants";
import { MonsterFighter } from "../../../fighter/MonsterFighter";
import { RandomUtils } from "../../../../../../../Lib/src/utils/RandomUtils";

const use: FightActionFunc = (sender, receiver, fightAction) => {
	// Check the number of energetic attacks the sender already used
	const timeAttackWasUsed = sender.fightActionsHistory.filter(action => action.id === FightConstants.FIGHT_ACTIONS.PLAYER.ENERGETIC_ATTACK).length;

	const result = simpleDamageFightAction(
		{
			sender,
			receiver
		},
		{
			critical: 35,
			failure: [
				0,
				3,
				7,
				60
			][Math.min(timeAttackWasUsed, 3)]
		},
		{
			attackInfo: getAttackInfo(),
			statsInfo: getStatsInfo(sender, receiver)
		}
	);

	/*
	 * Recovered energy is reduced after the third use of this action
	 * Recovered energy is divided by 2.5 if the opponent is a monster
	 */
	// calculate total division factor including monster penalty
	const divisionFactor = (timeAttackWasUsed <= 2 ? 2 : 20) * (receiver instanceof MonsterFighter ? 2.5 : 1);
	const recoveredEnergy = Math.round(result.damages! / divisionFactor);
	const cappedRecoveredEnergy = Math.min(recoveredEnergy, 200 + RandomUtils.variationInt(10));

	FightActionController.applyBuff(result, {
		selfTarget: true,
		stat: FightStatBuffed.ENERGY,
		operator: FightStatModifierOperation.ADDITION,
		value: cappedRecoveredEnergy
	}, sender, fightAction);

	return result;
};

export default use;

function getAttackInfo(): attackInfo {
	return {
		minDamage: 30,
		averageDamage: 95,
		maxDamage: 150
	};
}

function getStatsInfo(sender: Fighter, receiver: Fighter): statsInfo {
	return {
		attackerStats: [
			sender.getAttack(),
			sender.getSpeed()
		],
		defenderStats: [
			receiver.getDefense() * 0.2,
			receiver.getSpeed()
		],
		statsEffect: [
			0.75,
			0.25
		]
	};
}
