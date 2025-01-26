import {Fighter} from "../../../fighter/Fighter";
import {RandomUtils} from "../../../../../../../Lib/src/utils/RandomUtils";
import {FightAlterationFunc} from "../../../../../data/FightAlteration";
import {defaultDamageFightAlterationResult, defaultFightAlterationResult, defaultHealFightAlterationResult} from "../../../FightController";
import {attackInfo, statsInfo} from "../../FightActionController";

const use: FightAlterationFunc = (affected, _fightAlteration, opponent) => {
	if (affected.alterationTurn === 1 || affected.alterationTurn === 3) {
		return defaultFightAlterationResult();
	}

	if (affected.alterationTurn > 4 ||
		affected.alterationTurn > 2 && RandomUtils.draftbotRandom.bool(0.15) ||
		RandomUtils.draftbotRandom.bool(0.05)) {
		return defaultHealFightAlterationResult(affected);
	}

	return defaultDamageFightAlterationResult(affected, getStatsInfo(affected, opponent), getAttackInfo());
};

export default use;

function getAttackInfo(): attackInfo {
	return {minDamage: 45, averageDamage: 90, maxDamage: 150};
}

function getStatsInfo(victim: Fighter, sender: Fighter): statsInfo {
	return {
		attackerStats: [
			sender.getAttack()
		], defenderStats: [
			victim.getDefense()
		], statsEffect: [
			1
		]
	};
}