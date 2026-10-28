import { Fighter } from "../fighter/Fighter";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";

/**
 * Number of wear steps on the dark attack of a fighter: one per use, minus one every time
 * the fighter played RECOVERY_IDLE_ACTIONS actions in a row without it
 * @param fighter
 */
function getDarkAttackWear(fighter: Fighter): number {
	let wear = 0;
	let idleActions = 0;
	for (const action of fighter.fightActionsHistory) {
		if (action.id === FightConstants.FIGHT_ACTIONS.PLAYER.DARK_ATTACK) {
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
