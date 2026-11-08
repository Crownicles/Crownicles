import { PetAssistanceFunc } from "../../../../../data/PetAssistance";
import {
	PetAssistanceResult, PetAssistanceState
} from "../../../../../../../Lib/src/types/PetAssistanceResult";
import { Fighter } from "../../../fighter/Fighter";
import { FightAlterations } from "../../FightAlterations";
import { FightActionType } from "../../../../../../../Lib/src/types/FightActionType";

/**
 * Bonus on the melee (physical) damage of the owner gained at each of its turns, as long as the momentum is not broken.
 * Capped at +16% with 4 stacks: at +20%, the mammoth took half of the optimal level 100+ PvP meta in simulated fights
 */
const DAMAGE_BONUS_PER_STACK = 0.04;

const MAX_MOMENTUM_STACKS = 4;

/**
 * Alterations that immobilize the owner and break the momentum when they hit it.
 * Frozen is thawed by the mammoth's first power before this one is checked
 */
const MOMENTUM_BREAKERS: string[] = [
	FightAlterations.STUNNED,
	FightAlterations.PETRIFIED,
	FightAlterations.PARALYZED,
	FightAlterations.SLEEPING,
	FightAlterations.SWALLOWED,
	FightAlterations.FROZEN
];

// Momentum stacks of each owner, a fighter only lives for one fight
const momentumStacks = new WeakMap<Fighter, number>();

function breakMomentum(fighter: Fighter, stacks: number): PetAssistanceResult | null {
	momentumStacks.delete(fighter);
	return stacks > 0 ? { assistanceStatus: PetAssistanceState.FAILURE } : null;
}

/**
 * The pet acts before the owner's alteration, which is still there on the turn it wears off:
 * only an alteration that has not affected the owner yet (just inflicted) breaks the momentum
 */
function isJustImmobilized(fighter: Fighter): boolean {
	return fighter.alteration !== null && fighter.alterationTurn === 0 && MOMENTUM_BREAKERS.includes(fighter.alteration.id);
}

const use: PetAssistanceFunc = (fighter, _opponent, _turn, _fightController): Promise<PetAssistanceResult | null> => {
	const stacks = momentumStacks.get(fighter) ?? 0;
	if (isJustImmobilized(fighter)) {
		return Promise.resolve(breakMomentum(fighter, stacks));
	}

	const newStacks = Math.min(stacks + 1, MAX_MOMENTUM_STACKS);
	momentumStacks.set(fighter, newStacks);

	// The bonus lasts until the owner's next turn, where it is renewed. Only the melee attacks benefit from the mammoth's run
	fighter.applyDamageMultiplier(1 + newStacks * DAMAGE_BONUS_PER_STACK, 1, FightActionType.PHYSICAL);

	if (newStacks === stacks) {
		// Already at full speed, no need to announce it every turn
		return Promise.resolve(null);
	}
	return Promise.resolve({
		assistanceStatus: newStacks === MAX_MOMENTUM_STACKS ? PetAssistanceState.SUCCESS : PetAssistanceState.GENERAL_EFFECT
	});
};

export default use;
