import { Fighter } from "../../../fighter/Fighter";
import {
	attackInfo, statsInfo
} from "../../FightActionController";
import { FightAlterationFunc } from "../../../../../data/FightAlteration";
import { defaultDamageFightAlterationResult } from "../../../FightController";

const use: FightAlterationFunc = (affected, _fightAlteration, opponent) =>
	defaultDamageFightAlterationResult(opponent, getStatsInfo(affected, opponent), getAttackInfo());

export default use;

function getAttackInfo(): attackInfo {
	return {
		minDamage: 20,
		averageDamage: 80,
		maxDamage: 100
	};
}

function getStatsInfo(affected: Fighter, opponent: Fighter): statsInfo {
	return {
		attackerStats: [
			opponent.getAttack() / 4,
			opponent.getSpeed() / 4
		],
		defenderStats: [
			affected.getDefense(),
			affected.getSpeed()
		],
		statsEffect: [
			0.8,
			0.2
		]
	};
}
