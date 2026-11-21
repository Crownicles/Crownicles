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

/**
 * Number of turns the bleeding deals damage before healing
 */
export const BLEEDING_TURNS_TO_HEAL = 3;

/**
 * Monsters that are immune to bleeding
 * These monster IDs match the monster.id property (skeleton, rockGolem, magmaTitan, shinyElementary, celestialGuardian, yukiOnna, corruptedSylvan, motherTree)
 */
const IMMUNE_MONSTERS = [
	"skeleton",
	"rockGolem",
	"magmaTitan",
	"shinyElementary",
	"celestialGuardian",
	"yukiOnna",
	"corruptedSylvan",
	"motherTree"
];

const use: FightAlterationFunc = (affected, _fightAlteration, opponent) => {
	// Check if affected is an immune monster
	if (affected instanceof MonsterFighter && IMMUNE_MONSTERS.includes(affected.monster.id)) {
		return defaultHealFightAlterationResult(affected);
	}

	// Automatically heal the bleeding if greater than BLEEDING_TURNS_TO_HEAL or if the player used resting
	if (affected.alterationTurn > BLEEDING_TURNS_TO_HEAL || (affected.alterationTurn > 1 && affected.getLastFightActionUsed()?.id === FightConstants.FIGHT_ACTIONS.PLAYER.RESTING)) {
		return defaultHealFightAlterationResult(affected);
	}
	return defaultDamageFightAlterationResult(opponent, getStatsInfo(affected, opponent), getAttackInfo(affected.alterationTurn));
};

export default use;

function getAttackInfo(alterationTurn: number): attackInfo {
	const turnsReduceFactor = BLEEDING_TURNS_TO_HEAL + 1 - alterationTurn;
	return {
		minDamage: turnsReduceFactor * 10 / BLEEDING_TURNS_TO_HEAL,
		averageDamage: turnsReduceFactor * 50 / BLEEDING_TURNS_TO_HEAL,
		maxDamage: turnsReduceFactor * 65 / BLEEDING_TURNS_TO_HEAL
	};
}

function getStatsInfo(affected: Fighter, opponent: Fighter): statsInfo {
	return {
		attackerStats: [opponent.getAttack()],
		defenderStats: [affected.getDefense() / 4],
		statsEffect: [1]
	};
}
