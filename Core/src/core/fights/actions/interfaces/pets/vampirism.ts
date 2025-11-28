import {
	PetAssistanceResult, PetAssistanceState
} from "../../../../../../../Lib/src/types/PetAssistanceResult";
import { PetAssistanceFunc } from "../../../../../data/PetAssistance";
import {
	attackInfo, FightActionController, statsInfo
} from "../../FightActionController";
import { Fighter } from "../../../fighter/Fighter";
import { FightStatBuffed } from "../../../../../../../Lib/src/types/FightActionResult";
import { FightStatModifierOperation } from "../../../../../../../Lib/src/types/FightStatModifierOperation";
import { RandomUtils } from "../../../../../../../Lib/src/utils/RandomUtils";
import { FightUtils } from "../../../../utils/FightUtils";
import { PlayerFighter } from "../../../fighter/PlayerFighter";
import { PetDataController } from "../../../../../data/Pet";

function getAttackInfo(): attackInfo {
	return {
		minDamage: 7,
		averageDamage: 33,
		maxDamage: 65
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
			0,
			receiver.getDefense()
		],
		statsEffect: [
			0.5,
			0.5
		]
	};
}

const use: PetAssistanceFunc = (fighter, opponent, _turn, _fightController): Promise<PetAssistanceResult | null> => {
	// 75% chance of doing nothing
	if (RandomUtils.crowniclesRandom.bool(0.75)) {
		return Promise.resolve(null);
	}

	const damages = FightActionController.getAttackDamage(getStatsInfo(fighter, opponent), fighter, getAttackInfo(), true);
	const result: PetAssistanceResult = {
		damages,
		assistanceStatus: PetAssistanceState.SUCCESS
	};

	FightActionController.applyBuff(result, {
		selfTarget: true,
		stat: FightStatBuffed.ENERGY,
		operator: FightStatModifierOperation.ADDITION,
		value: damages
	}, fighter, this);

	return Promise.resolve(result);
};

export default use;
