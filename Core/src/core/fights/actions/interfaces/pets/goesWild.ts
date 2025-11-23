import { Fighter } from "../../../fighter/Fighter";
import {
	attackInfo, FightActionController, statsInfo
} from "../../FightActionController";
import { PetAssistanceFunc } from "../../../../../data/PetAssistance";
import {
	PetAssistanceResult, PetAssistanceState
} from "../../../../../../../Lib/src/types/PetAssistanceResult";
import { FightStatBuffed } from "../../../../../../../Lib/src/types/FightActionResult";
import { FightStatModifierOperation } from "../../../../../../../Lib/src/types/FightStatModifierOperation";
import { FightUtils } from "../../../../utils/FightUtils";
import { PlayerFighter } from "../../../fighter/PlayerFighter";
import { PetDataController } from "../../../../../data/Pet";

function getAttackInfo(): attackInfo {
	return {
		minDamage: 15,
		averageDamage: 110,
		maxDamage: 170
	};
}

function getStatsInfo(sender: Fighter, receiver: Fighter): statsInfo {
	const petId = (sender as PlayerFighter).pet.typeId;
	const force = PetDataController.instance.getById(petId).force;
	return {
		attackerStats: [
			FightUtils.calculatePetStatFromForce(force, sender.level),
			FightUtils.calculatePetStatFromForce(force, sender.level)
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
	const force = PetDataController.instance.getById((fighter as PlayerFighter).pet.typeId).force;
	const baseTurn = Math.floor(force / 2);
	if (turn !== baseTurn + 2 && turn !== baseTurn + 3) {
		return null;
	}
	const damages = FightActionController.getAttackDamage(getStatsInfo(fighter, opponent), fighter, getAttackInfo(), true);

	const result: PetAssistanceResult = {
		damages,
		assistanceStatus: PetAssistanceState.SUCCESS
	};

	FightActionController.applyBuff(result, {
		selfTarget: true,
		stat: FightStatBuffed.DAMAGE,
		operator: FightStatModifierOperation.ADDITION,
		value: Math.round(damages * 0.2)
	}, fighter, this);

	return Promise.resolve(result);
};

export default use;
