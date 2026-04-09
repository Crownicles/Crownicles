import { Fighter } from "../../../fighter/Fighter";
import {
	attackInfo, statsInfo
} from "../../FightActionController";
import { FightActionFunc } from "../../../../../data/FightAction";
import { simpleDamageFightAction } from "../../templates/SimpleDamageFightActionTemplate";
import {
	customMessageFailActionResult,
	defaultMaxUsesFightActionResult
} from "../../../../../../../Lib/src/types/FightActionResult";
import { PlayerFighter } from "../../../fighter/PlayerFighter";
import { PetConstants } from "../../../../../../../Lib/src/constants/PetConstants";
import { FightConstants } from "../../../../../../../Lib/src/constants/FightConstants";

function getAttackInfo(): attackInfo {
	return {
		minDamage: 100,
		averageDamage: 210,
		maxDamage: 300
	};
}

function getStatsInfo(sender: Fighter, receiver: Fighter): statsInfo {
	return {
		attackerStats: [sender.getAttack()],
		defenderStats: [receiver.getDefense()],
		statsEffect: [1]
	};
}

const use: FightActionFunc = (sender, receiver, _fightAction) => {
	const result = simpleDamageFightAction(
		{
			sender,
			receiver
		},
		{
			critical: 0,
			failure: 0
		},
		{
			attackInfo: getAttackInfo(),
			statsInfo: getStatsInfo(sender, receiver)
		}
	);

	const useCount = sender.fightActionsHistory.filter(action => action.id === FightConstants.FIGHT_ACTIONS.MONSTER.FATAL_FLIGHT).length;
	if (useCount >= 1) {
		return defaultMaxUsesFightActionResult();
	}

	// This attack will fail if the opponent has a raven
	if (receiver instanceof PlayerFighter && receiver.pet && PetConstants.PETS.RAVEN === receiver.pet.typeId) {
		return {
			...customMessageFailActionResult(),
			damages: 0
		};
	}

	return {
		...result,
		customMessage: true
	};
};

export default use;
