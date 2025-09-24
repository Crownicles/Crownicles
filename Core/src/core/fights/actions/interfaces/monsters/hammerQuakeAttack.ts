import { Fighter } from "../../../fighter/Fighter";
import {
	attackInfo, statsInfo
} from "../../FightActionController";
import { FightActionFunc } from "../../../../../data/FightAction";
import {
	customMessageActionResult
} from "../../../../../../../Lib/src/types/FightActionResult";
import { RealPlayerFighter } from "../../../fighter/RealPlayerFighter";
import { PetConstants } from "../../../../../../../Lib/src/constants/PetConstants";
import { simpleDamageFightAction } from "../../templates/SimpleDamageFightActionTemplate";

const use: FightActionFunc = (sender, receiver) => {
	// This attack will fail if the opponent has a flying pet
	if (receiver instanceof RealPlayerFighter && receiver.pet && PetConstants.FLYING_PETS.includes(receiver.pet.typeId)) {
		return {
			...customMessageActionResult(),
			damages: 0
		};
	}


	return simpleDamageFightAction(
		{
			sender,
			receiver
		},
		{
			critical: 5,
			failure: 0
		},
		{
			attackInfo: getAttackInfo(),
			statsInfo: getStatsInfo(sender, receiver)
		}
	);
};

export default use;

function getAttackInfo(): attackInfo {
	return {
		minDamage: 40,
		averageDamage: 170,
		maxDamage: 300
	};
}

function getStatsInfo(sender: Fighter, receiver: Fighter): statsInfo {
	return {
		attackerStats: [
			sender.getAttack(),
			sender.getDefense()
		],
		defenderStats: [
			receiver.getDefense(),
			receiver.getDefense()
		],
		statsEffect: [
			0.3,
			0.7
		]
	};
}
