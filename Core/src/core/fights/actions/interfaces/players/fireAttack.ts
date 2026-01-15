import { Fighter } from "../../../fighter/Fighter";
import {
	attackInfo, FightActionController, statsInfo
} from "../../FightActionController";
import { FightAlterations } from "../../FightAlterations";
import { FightActionFunc } from "../../../../../data/FightAction";
import {
	customMessageActionResult,
	FightActionResult
} from "../../../../../../../Lib/src/types/FightActionResult";
import { MonsterFighter } from "../../../fighter/MonsterFighter";

const IMMUNE_MONSTERS = ["waterSpirit"];

const use: FightActionFunc = (sender, receiver) => {
	if (receiver instanceof MonsterFighter && IMMUNE_MONSTERS.includes(receiver.monster.id)) {
		return {
			...customMessageActionResult(),
			damages: 0
		};
	}
	const initialDamage = FightActionController.getAttackDamage(getStatsInfo(sender, receiver), sender, getAttackInfo());
	const damageDealt = FightActionController.applySecondaryEffects(initialDamage, 12, 4);

	const result: FightActionResult = {
		attackStatus: damageDealt.status,
		damages: damageDealt.damages
	};

	FightActionController.applyAlteration(result, {
		selfTarget: false,
		alteration: FightAlterations.BURNED
	}, receiver);

	return result;
};

export default use;

function getAttackInfo(): attackInfo {
	return {
		minDamage: 20,
		averageDamage: 110,
		maxDamage: 150
	};
}

function getStatsInfo(sender: Fighter, receiver: Fighter): statsInfo {
	return {
		attackerStats: [sender.getAttack()],
		defenderStats: [receiver.getDefense() / 4],
		statsEffect: [1]
	};
}
