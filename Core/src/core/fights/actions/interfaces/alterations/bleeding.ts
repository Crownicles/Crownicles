import { Fighter } from "../../../fighter/Fighter";
import { MonsterFighter } from "../../../fighter/MonsterFighter";
import {
	attackInfo, statsInfo
} from "../../FightActionController";
import { FightAlterationFunc } from "../../../../../data/FightAlteration";
import {
	defaultDamageFightAlterationResult, defaultHealFightAlterationResult
} from "../../../FightController";
import { FightConstants } from "../../../../../../../Lib/src/constants/FightConstants";

const turnsToHeal = 3;

/**
 * Monsters that are immune to bleeding
 * These monster IDs match the monster.id property (skeleton, rockGolem, magmaTitan, shinyElementary, celestialGuardian, yukiOnna)
 */
const IMMUNE_MONSTERS = [
	"skeleton",
	"rockGolem",
	"magmaTitan",
	"shinyElementary",
	"celestialGuardian",
	"yukiOnna"
];

const use: FightAlterationFunc = (affected, _fightAlteration, opponent) => {
	// Check if affected is an immune monster
	if (affected instanceof MonsterFighter && IMMUNE_MONSTERS.includes(affected.monster.id)) {
		return defaultHealFightAlterationResult(affected);
	}

	// Automatically heal the bleeding if greater than turnsToHeal or if the player used resting
	if (affected.alterationTurn > turnsToHeal || (affected.alterationTurn > 1 && affected.getLastFightActionUsed()?.id === FightConstants.FIGHT_ACTIONS.PLAYER.RESTING)) {
		return defaultHealFightAlterationResult(affected);
	}
	return defaultDamageFightAlterationResult(affected, getStatsInfo(affected, opponent), getAttackInfo(affected.alterationTurn));
};

export default use;

function getAttackInfo(alterationTurn: number): attackInfo {
	const turnsReduceFactor = turnsToHeal + 1 - alterationTurn;
	return {
		minDamage: turnsReduceFactor * 10 / turnsToHeal,
		averageDamage: turnsReduceFactor * 50 / turnsToHeal,
		maxDamage: turnsReduceFactor * 65 / turnsToHeal
	};
}

function getStatsInfo(affected: Fighter, opponent: Fighter): statsInfo {
	return {
		attackerStats: [opponent.getAttack()],
		defenderStats: [affected.getDefense() / 4],
		statsEffect: [1]
	};
}
