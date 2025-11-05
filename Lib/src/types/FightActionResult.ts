import { FightStatModifierOperation } from "./FightStatModifierOperation";
import { FightActionStatus } from "./FightActionStatus";
import { FightActionType } from "./FightActionType";

export enum FightStatBuffed {
	ATTACK,
	DEFENSE,
	SPEED,
	BREATH,
	ENERGY,
	DAMAGE,
	SUMMON,
	DAMAGE_BOOST
}

export interface FightActionBuff {
	selfTarget: boolean;
	stat: FightStatBuffed;
	operator: FightStatModifierOperation;
	value: number;
	duration?: number;
}

export interface FightActionTypeResistance {
	selfTarget: boolean;
	type: FightActionType;
	value: number;
	duration?: number;
}

export interface FightActionResult {
	fail?: boolean;
	buffs?: FightActionBuff[];
	resistances?: FightActionTypeResistance[];
	damages?: number;
	attackStatus: FightActionStatus;
	alterations?: FightAlterationApplied[];
	customMessage?: boolean; // If true, the attack should be displayed with a custom message
	usedAction?: {
		id: string;
		result: FightActionResult;
	};
}

/**
 * Create a default FightActionResult
 * Will be displayed as "XXX used Attack YYY"
 */
export function defaultFightActionResult(): FightActionResult {
	return {
		attackStatus: FightActionStatus.NORMAL,
		customMessage: false
	};
}

/**
 * Create a custom message FightActionResult,
 * For example, resting should not be display as "XXX used Attack resting" but "XXX is resting"
 */
export function customMessageActionResult(): FightActionResult {
	return {
		attackStatus: FightActionStatus.NORMAL,
		customMessage: true
	};
}

export function defaultFailFightActionResult(): FightActionResult {
	return {
		fail: true,
		attackStatus: FightActionStatus.MISSED
	};
}


export function defaultMaxUsesFightActionResult(): FightActionResult {
	return {
		fail: true,
		attackStatus: FightActionStatus.MAX_USES
	};
}

export function fightActionResultFromSuccessTest(success: boolean): FightActionResult {
	return success ? defaultFightActionResult() : defaultFailFightActionResult();
}

export function updateFightActionResultFromSuccessTest(result: FightActionResult, success: boolean): FightActionResult {
	result.fail = !success;
	result.attackStatus = success ? FightActionStatus.NORMAL : FightActionStatus.MISSED;
	return result;
}

export interface FightAlterationApplied {
	selfTarget: boolean;
	alteration: string;
}
