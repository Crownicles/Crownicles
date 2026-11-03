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
 * The ambush happens in about 57% of the PvP fights (share of the fighters resting at least once).
 * Tuned with AI fights between level 100+ players: over a fight it deals slightly less damage than the claws of a tiger (~95%),
 * a single blow being less decisive than damage spread over the fight, it wins fewer fights than the tiger
 */
function getAttackInfo(): attackInfo {
	return {
		minDamage: 55,
		averageDamage: 225,
		maxDamage: 310
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

function isCatchingBreath(opponent: Fighter): boolean {
	const lastActionId = opponent.fightActionsHistory.at(-1)?.id;
	return lastActionId !== undefined && CATCHING_BREATH_ACTIONS.includes(lastActionId);
}

const use: PetAssistanceFunc = (fighter, opponent, _turn, _fightController): Promise<PetAssistanceResult | null> => {
	if (ambushedOwners.has(fighter) || !isCatchingBreath(opponent)) {
		return Promise.resolve(null);
	}

	ambushedOwners.add(fighter);
	return Promise.resolve({
		damages: FightActionController.getAttackDamage(getStatsInfo(fighter, opponent), fighter, getAttackInfo(), true),
		assistanceStatus: PetAssistanceState.SUCCESS
	});
};

export default use;
