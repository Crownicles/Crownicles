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
		minDamage: 35,
		averageDamage: 60,
		maxDamage: 80
	};
}

function getStatsInfo(sender: Fighter, receiver: Fighter): statsInfo {
	const petId = (sender as PlayerFighter).pet.typeId;
	const petData = PetDataController.instance.getById(petId);
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

const use: PetAssistanceFunc = (fighter, opponent, turn, _fightController): Promise<PetAssistanceResult | null> => {
	if (RandomUtils.crowniclesRandom.bool(0.85) || turn <= 2) {
		return null;
	}

	// Only do something if the last action was a physical attack
	if (!opponent.getLastFightActionUsed() || opponent.getLastFightActionUsed().type !== FightActionType.PHYSICAL) {
		return null;
	}

	return Promise.resolve({
		damages: FightActionController.getAttackDamage(getStatsInfo(fighter, opponent), fighter, getAttackInfo(), true),
		assistanceStatus: PetAssistanceState.SUCCESS
	});
};

export default use;
