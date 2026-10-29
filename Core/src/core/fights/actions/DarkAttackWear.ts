import { Fighter } from "../fighter/Fighter";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";

// History positions of the dark attacks each fighter missed: a missed dark attack does not wear the attack down
const missedDarkAttacks = new WeakMap<Fighter, Set<number>>();

/**
 * Record that the dark attack the fighter is playing missed. The action is pushed to the history right after
 * it is played, so it will sit at the current end of the history
 * @param fighter
 */
export function recordMissedDarkAttack(fighter: Fighter): void {
	const missed = missedDarkAttacks.get(fighter) ?? new Set<number>();
	missed.add(fighter.fightActionsHistory.length);
	missedDarkAttacks.set(fighter, missed);
}

/**
 * Number of wear steps on the dark attack of a fighter: one per use that did not miss, minus one every time
 * the fighter played RECOVERY_IDLE_ACTIONS actions in a row without it
 * @param fighter
 */
function getDarkAttackWear(fighter: Fighter): number {
	const missed = missedDarkAttacks.get(fighter);
	let wear = 0;
	let idleActions = 0;
	for (const [index, action] of fighter.fightActionsHistory.entries()) {
		if (action.id === FightConstants.FIGHT_ACTIONS.PLAYER.DARK_ATTACK) {
			if (missed?.has(index)) {
				// A missed dark attack neither wears the attack down nor lets it recover
				continue;
			}
			wear++;
			idleActions = 0;
			continue;
		}
		idleActions++;
		if (idleActions >= FightConstants.DARK_ATTACK_WEAR.RECOVERY_IDLE_ACTIONS && wear > 0) {
			wear--;
			idleActions = 0;
		}
	}
	return wear;
}

/**
 * Damage multiplier of the next dark attack of a fighter, which wears down with each use and recovers when it is left aside
 * @param fighter
 */
export function getDarkAttackPowerMultiplier(fighter: Fighter): number {
	const wearConstants = FightConstants.DARK_ATTACK_WEAR;
	const multiplier = wearConstants.BASE_MULTIPLIER - wearConstants.MULTIPLIER_LOSS_PER_USE * getDarkAttackWear(fighter);

	// Rounded to a tenth: the steps are tenths and the subtraction leaves floating point noise
	return Math.max(wearConstants.MIN_MULTIPLIER, Math.round(multiplier * 10) / 10);
}
