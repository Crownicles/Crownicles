import { Fighter } from "../../../fighter/Fighter";
import {
	attackInfo, statsInfo
} from "../../FightActionController";
import { FightActionFunc } from "../../../../../data/FightAction";
import { simpleDamageFightAction } from "../../templates/SimpleDamageFightActionTemplate";

const use: FightActionFunc = (sender, receiver) => simpleDamageFightAction(
	{
		sender,
		receiver
	},
	{
		critical: 5,
		failure: 10
	},
	{
		attackInfo: getAttackInfo(),
		statsInfo: getStatsInfo(sender, receiver)
	}
);

function getAttackInfo(): attackInfo {
	return {
		minDamage: 25,
		averageDamage: 110,
		maxDamage: 160
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
			0.8,
			0.2
		]
	};
}

export default use;
