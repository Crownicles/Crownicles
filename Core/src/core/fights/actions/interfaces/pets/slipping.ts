import { Fighter } from "../../../fighter/Fighter";
import {
	attackInfo, FightActionController, statsInfo
} from "../../FightActionController";
import { PetAssistanceFunc } from "../../../../../data/PetAssistance";
import {
	PetAssistanceResult, PetAssistanceState
} from "../../../../../../../Lib/src/types/PetAssistanceResult";
import { RandomUtils } from "../../../../../../../Lib/src/utils/RandomUtils";
import { FightActionType } from "../../../../../../../Lib/src/types/FightActionType";
import { FightUtils } from "../../../../utils/FightUtils";
import { PlayerFighter } from "../../../fighter/PlayerFighter";
import { PetDataController } from "../../../../../data/Pet";

function getAttackInfo(): attackInfo {
	return {
		minDamage: 5,
		averageDamage: 30,
		maxDamage: 80
	};
}

function getStatsInfo(sender: Fighter, receiver: Fighter): statsInfo {
	const petId = (sender as PlayerFighter).pet!.typeId;
	const petData = PetDataController.instance.getById(petId)!;
	return {
		attackerStats: [
			FightUtils.calculatePetStatFromForce(petData.force, sender.level),
			FightUtils.calculatePetStatFromSpeed(petData.speed, sender.level)
		],
		defenderStats: [
			receiver.getDefense(),
			receiver.getSpeed()
		],
		statsEffect: [
			0.9,
			0.1
		]
	};
}

const use: PetAssistanceFunc = (fighter, opponent, _turn, _fightController): Promise<PetAssistanceResult | null> => {
	// 40% chance of doing nothing and does not trigger if opponent last action is magic
	if (RandomUtils.crowniclesRandom.bool(0.4) || opponent.getLastFightActionUsed()?.type === FightActionType.MAGIC) {
		return Promise.resolve(null);
	}

	/*
	 * If opponent last action was distance,
	 * Damages are halved because the pet is slipping too far away and status is set to failure
	 */
	return Promise.resolve({
		damages: Math.round(FightActionController.getAttackDamage(getStatsInfo(fighter, opponent), fighter, getAttackInfo(), true)
			* (opponent.getLastFightActionUsed()?.type === FightActionType.DISTANCE ? 0.3 : 1)),
		assistanceStatus: opponent.getLastFightActionUsed()?.type === FightActionType.DISTANCE ? PetAssistanceState.FAILURE : PetAssistanceState.SUCCESS
	});
};

export default use;
