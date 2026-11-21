import { Fighter } from "../../../fighter/Fighter";
import {
	attackInfo, FightActionController, statsInfo
} from "../../FightActionController";
import { PetAssistanceFunc } from "../../../../../data/PetAssistance";
import {
	PetAssistanceResult, PetAssistanceState
} from "../../../../../../../Lib/src/types/PetAssistanceResult";
import { FightUtils } from "../../../../utils/FightUtils";
import { PlayerBaseFighter } from "../../../fighter/PlayerBaseFighter";
import { PetDataController } from "../../../../../data/Pet";

function getAttackInfo(): attackInfo {
	return {
		minDamage: 35,
		averageDamage: 80,
		maxDamage: 140
	};
}

function getStatsInfo(sender: PlayerBaseFighter, receiver: Fighter): statsInfo {
	const petId = sender.pet!.typeId;
	const petData = PetDataController.instance.getById(petId)!;
	return {
		attackerStats: [
			FightUtils.calculatePetStatFromForce(petData.force, sender.level),
			FightUtils.calculatePetStatFromSpeed(petData.speed, sender.level)
		],
		defenderStats: [
			receiver.getDefense() * 2,
			receiver.getSpeed()
		],
		statsEffect: [
			0.9,
			0.1
		]
	};
}

/**
 * The pet charges twice per fight: it takes a run-up on the first turn of a pair, then strikes on the next one
 */
const RUN_UP_TURNS = [
	1,
	2,
	13,
	14
];

const STRIKE_TURNS = [
	3,
	4,
	15,
	16
];

const use: PetAssistanceFunc = (fighter, opponent, turn, _fightController): Promise<PetAssistanceResult | null> => {
	if (RUN_UP_TURNS.includes(turn)) {
		return Promise.resolve({
			assistanceStatus: PetAssistanceState.GENERAL_EFFECT
		});
	}

	if (STRIKE_TURNS.includes(turn)) {
		return Promise.resolve({
			damages: FightActionController.getAttackDamage(getStatsInfo(fighter, opponent), fighter, getAttackInfo(), true),
			assistanceStatus: PetAssistanceState.SUCCESS
		});
	}
	return Promise.resolve(null);
};

export default use;
