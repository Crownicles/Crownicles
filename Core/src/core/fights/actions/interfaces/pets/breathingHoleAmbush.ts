import {
	attackInfo, FightActionController, statsInfo
} from "../../FightActionController";
import { PetAssistanceFunc } from "../../../../../data/PetAssistance";
import {
	PetAssistanceResult, PetAssistanceState
} from "../../../../../../../Lib/src/types/PetAssistanceResult";
import { Fighter } from "../../../fighter/Fighter";
import { FightUtils } from "../../../../utils/FightUtils";
import { FightConstants } from "../../../../../../../Lib/src/constants/FightConstants";

/**
 * Actions after which the opponent is catching its breath, like a seal surfacing at a breathing hole
 */
const CATCHING_BREATH_ACTIONS: string[] = [
	FightConstants.FIGHT_ACTIONS.PLAYER.RESTING,
	FightConstants.FIGHT_ACTIONS.ALTERATION.OUT_OF_BREATH
];

// Owners whose bear already struck, the ambush only happens once per fight
const ambushedOwners = new WeakSet<Fighter>();

/**
 * Tuned so that the ambush, which happens in about 57% of the PvP fights (share of the fighters resting at least once),
 * deals around 90% of the damage dealt by the claws of a tiger over a whole fight
 */
function getAttackInfo(): attackInfo {
	return {
		minDamage: 45,
		averageDamage: 185,
		maxDamage: 255
	};
}

function getStatsInfo(sender: Fighter, receiver: Fighter): statsInfo {
	const petStats = FightUtils.getPetFightStats(sender);
	return {
		attackerStats: [
			petStats.force,
			petStats.speed
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
	const opponentLastActionId = opponent.fightActionsHistory.at(-1)?.id;
	if (ambushedOwners.has(fighter) || !opponentLastActionId || !CATCHING_BREATH_ACTIONS.includes(opponentLastActionId)) {
		return Promise.resolve(null);
	}

	ambushedOwners.add(fighter);
	return Promise.resolve({
		damages: FightActionController.getAttackDamage(getStatsInfo(fighter, opponent), fighter, getAttackInfo(), true),
		assistanceStatus: PetAssistanceState.SUCCESS
	});
};

export default use;
