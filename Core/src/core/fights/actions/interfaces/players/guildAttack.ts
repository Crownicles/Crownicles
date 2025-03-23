import {Fighter} from "../../../fighter/Fighter";
import {simpleDamageFightAction} from "../../templates/SimpleDamageFightActionTemplate";
import {PlayerFighter} from "../../../fighter/PlayerFighter";
import {FightActionFunc} from "../../../../../data/FightAction";
import {attackInfo, statsInfo} from "../../FightActionController";

const use: FightActionFunc = (sender, receiver) => simpleDamageFightAction(
	{
		sender,
		receiver
	},
	{
		critical: 10,
		failure: 10
	},
	{
		attackInfo: getAttackInfo(),
		statsInfo: getStatsInfo(sender, receiver)
	}
);

export default use;

function getAttackInfo(): attackInfo {
	return {
		minDamage: 110,
		averageDamage: 130,
		maxDamage: 250
	};
}

function getStatsInfo(sender: Fighter, receiver: Fighter): statsInfo {
	let cumulatedAttack = sender.getAttack();
	let cumulatedSpeed = sender.getSpeed();
	for (const member of (sender as PlayerFighter).getPveMembersOnIsland()) {
		cumulatedAttack += member.attack;
		cumulatedSpeed += member.speed;
	}

	return {
		attackerStats: [
			cumulatedAttack,
			cumulatedSpeed
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