import { Fighter } from "../../../fighter/Fighter";
import {
	attackInfo, FightActionController, statsInfo
} from "../../FightActionController";
import { MathUtils } from "../../../../utils/MathUtils";
import { FightConstants } from "../../../../../../../Lib/src/constants/FightConstants";
import {
	FightAlterationDataController,
	FightAlterationFunc
} from "../../../../../data/FightAlteration";
import {
	defaultFightAlterationResult, defaultHealFightAlterationResult
} from "../../../FightController";
import { FightAlterations } from "../../FightAlterations";

const use: FightAlterationFunc = (affected, _fightAlteration, opponent, turn) => {
	if ((Math.random() < 0.4 && affected.alterationTurn > 2) || affected.alterationTurn > 4) {
		const result = defaultHealFightAlterationResult(affected);
		let damageDealt = FightActionController.getAttackDamage(getStatsInfo(affected, opponent), affected, getAttackInfo(), true);
		damageDealt += MathUtils.getIntervalValue(0, damageDealt * 2, (affected.alterationTurn - 2) / 3);
		damageDealt += MathUtils.getIntervalValue(0, damageDealt, Math.min(turn, FightConstants.MAX_TURNS) / FightConstants.MAX_TURNS);
		result.damages = Math.round(damageDealt);
		affected.newAlteration(FightAlterationDataController.instance.getById(FightAlterations.SUBMERGED));
		return result;
	}
	return defaultFightAlterationResult();
};

export default use;

function getAttackInfo(): attackInfo {
	return {
		minDamage: 50,
		averageDamage: 100,
		maxDamage: 130
	};
}

function getStatsInfo(victim: Fighter, sender: Fighter): statsInfo {
	return {
		attackerStats: [sender.getAttack()],
		defenderStats: [victim.getDefense()],
		statsEffect: [1]
	};
}
