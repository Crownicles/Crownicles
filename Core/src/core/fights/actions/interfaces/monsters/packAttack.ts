import {
	FightActionDataController, FightActionFunc
} from "../../../../../data/FightAction";
import { Fighter } from "../../../fighter/Fighter";
import { simpleDamageFightAction } from "../../templates/SimpleDamageFightActionTemplate";
import {
	attackInfo, statsInfo
} from "../../FightActionController";
import { RandomUtils } from "../../../../../../../Lib/src/utils/RandomUtils";

const use: FightActionFunc = (sender, receiver) => {
	const nbOfMonsters = RandomUtils.crowniclesRandom.integer(2, 5);
	const result = simpleDamageFightAction(
		{
			sender, receiver
		},
		{
			critical: 10, failure: 0
		},
		{
			attackInfo: getAttackInfo(nbOfMonsters), statsInfo: getStatsInfo(sender, receiver, nbOfMonsters)
		}
	);
	if (nbOfMonsters <= 3) {
		sender.nextFightAction = FightActionDataController.instance.getById("packAttack") ?? null;
	}
	return result;
};

function getAttackInfo(nbOfMonsters: number): attackInfo {
	return {
		minDamage: 5 * nbOfMonsters,
		averageDamage: 30 * nbOfMonsters,
		maxDamage: 55 * nbOfMonsters
	};
}

function getStatsInfo(sender: Fighter, receiver: Fighter, nbOfMonsters: number): statsInfo {
	return {
		attackerStats: [sender.getAttack()],
		defenderStats: [receiver.getDefense() / nbOfMonsters],
		statsEffect: [1]
	};
}

export default use;
