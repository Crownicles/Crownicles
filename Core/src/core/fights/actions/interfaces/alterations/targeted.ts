import { Fighter } from "../../../fighter/Fighter";
import { RandomUtils } from "../../../../../../../Lib/src/utils/RandomUtils";
import { FightAlterationFunc } from "../../../../../data/FightAlteration";
import {
	defaultDamageFightAlterationResult, defaultHealFightAlterationResult
} from "../../../FightController";
import { statsInfo } from "../../FightActionController";
import { getBoomerangAttackInfo } from "../players/boomerangAttack";
import { FightAlterationState } from "../../../../../../../Lib/src/types/FightAlterationResult";

const use: FightAlterationFunc = (affected, _fightAlteration, opponent) => {
	if (affected.alterationTurn === 1 || affected.alterationTurn === 3) {
		return {
			state: FightAlterationState.NEW
		};
	}

	if (affected.alterationTurn > 4
		|| affected.alterationTurn > 2 && RandomUtils.crowniclesRandom.bool(0.15)
		|| RandomUtils.crowniclesRandom.bool(0.05)) {
		return defaultHealFightAlterationResult(affected);
	}

	return defaultDamageFightAlterationResult(opponent, getStatsInfo(affected, opponent), getBoomerangAttackInfo());
};

export default use;

function getStatsInfo(victim: Fighter, sender: Fighter): statsInfo {
	return {
		attackerStats: [sender.getAttack()], defenderStats: [victim.getDefense()], statsEffect: [1]
	};
}
