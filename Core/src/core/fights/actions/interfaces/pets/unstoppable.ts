import { PetAssistanceFunc } from "../../../../../data/PetAssistance";
import {
	PetAssistanceResult, PetAssistanceState
} from "../../../../../../../Lib/src/types/PetAssistanceResult";
import { Fighter } from "../../../fighter/Fighter";
import { FightAlterations } from "../../FightAlterations";

/**
 * Damage bonus gained by the owner at each of its turns, as long as the momentum is not broken
 */
const DAMAGE_BONUS_PER_STACK = 0.04;

const MAX_MOMENTUM_STACKS = 5;

/**
 * Alterations that immobilize the owner and break the momentum.
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

const use: PetAssistanceFunc = (fighter, _opponent, _turn, _fightController): Promise<PetAssistanceResult | null> => {
	const stacks = momentumStacks.get(fighter) ?? 0;
	if (fighter.alteration && MOMENTUM_BREAKERS.includes(fighter.alteration.id)) {
		return Promise.resolve(breakMomentum(fighter, stacks));
	}

	const newStacks = Math.min(stacks + 1, MAX_MOMENTUM_STACKS);
	momentumStacks.set(fighter, newStacks);

	// The bonus lasts until the owner's next turn, where it is renewed
	fighter.applyDamageMultiplier(1 + newStacks * DAMAGE_BONUS_PER_STACK, 1);

	if (newStacks === stacks) {
		// Already at full speed, no need to announce it every turn
		return Promise.resolve(null);
	}
	return Promise.resolve({
		assistanceStatus: newStacks === MAX_MOMENTUM_STACKS ? PetAssistanceState.SUCCESS : PetAssistanceState.GENERAL_EFFECT
	});
};

export default use;
