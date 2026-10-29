import { AiPlayerFighter } from "../fighter/AiPlayerFighter";
import { RealPlayerFighter } from "../fighter/RealPlayerFighter";
import { FightActionDataController } from "../../../data/FightAction";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";

// The two-turn charging attack is not started against an opponent this close to death
const MIN_OPPONENT_ENERGY_RATIO_TO_CHARGE = 0.16;

// Opponent actions preparing a two-turn action: charging into them is a bad trade
const OPPONENT_PREPARING_ACTIONS: string[] = [
	FightConstants.FIGHT_ACTIONS.PLAYER.CHARGE_ULTIMATE_ATTACK,
	FightConstants.FIGHT_ACTIONS.PLAYER.CHARGE_CHARGING_ATTACK,
	FightConstants.FIGHT_ACTIONS.PLAYER.RESTING
];

function canAfford(me: AiPlayerFighter, actionId: string): boolean {
	return me.getBreath() >= FightActionDataController.getFightActionBreathCost(actionId);
}

/**
 * Check if the opponent has just rested and the energetic attack is affordable: it deals more damage to a rested opponent
 * @param me
 * @param opponent
 */
export function shouldPunishRest(me: AiPlayerFighter, opponent: AiPlayerFighter | RealPlayerFighter): boolean {
	return opponent.getLastFightActionUsed()?.id === FightConstants.FIGHT_ACTIONS.PLAYER.RESTING
		&& canAfford(me, FightConstants.FIGHT_ACTIONS.PLAYER.ENERGETIC_ATTACK);
}

/**
 * Check if the veteran should start its two-turn charging attack: affordable, and the opponent is neither preparing
 * a two-turn action itself nor too close to death to be worth it
 * @param me
 * @param opponent
 */
export function shouldStartChargingAttack(me: AiPlayerFighter, opponent: AiPlayerFighter | RealPlayerFighter): boolean {
	const opponentLastActionId = opponent.getLastFightActionUsed()?.id;
	const opponentIsPreparing = opponentLastActionId !== undefined && OPPONENT_PREPARING_ACTIONS.includes(opponentLastActionId);
	const opponentWorthCharging = opponent.getEnergy() > opponent.getMaxEnergy() * MIN_OPPONENT_ENERGY_RATIO_TO_CHARGE;
	return canAfford(me, FightConstants.FIGHT_ACTIONS.PLAYER.CHARGE_CHARGING_ATTACK) && !opponentIsPreparing && opponentWorthCharging;
}

/**
 * Check if the veteran is concentrated and can spend this boost on an energetic attack
 * @param me
 */
export function shouldUseConcentratedEnergeticAttack(me: AiPlayerFighter): boolean {
	return me.alteration?.id === FightConstants.FIGHT_ACTIONS.ALTERATION.CONCENTRATED
		&& canAfford(me, FightConstants.FIGHT_ACTIONS.PLAYER.ENERGETIC_ATTACK);
}

/**
 * Check if concentrating now leaves enough breath, after the regeneration, for an energetic attack on the next turn,
 * and if the veteran cannot already afford both actions without waiting
 * @param me
 */
export function shouldConcentrateBeforeEnergeticAttack(me: AiPlayerFighter): boolean {
	const concentrationCost = FightActionDataController.getFightActionBreathCost(FightConstants.FIGHT_ACTIONS.PLAYER.CONCENTRATION);
	const energeticAttackCost = FightActionDataController.getFightActionBreathCost(FightConstants.FIGHT_ACTIONS.PLAYER.ENERGETIC_ATTACK);
	const affordableNextTurn = me.getBreath() - concentrationCost + me.getRegenBreath() >= energeticAttackCost;
	return !me.hasFightAlteration() && affordableNextTurn && me.getBreath() < energeticAttackCost + concentrationCost;
}

/**
 * Check if the energetic attack is worth it for the charger: it heals a hurt veteran and punishes a rested opponent
 * @param me
 * @param opponent
 * @param healingEnergyRatio Share of its energy under which the veteran wants the heal
 */
export function shouldChargerUseEnergeticAttack(me: AiPlayerFighter, opponent: AiPlayerFighter | RealPlayerFighter, healingEnergyRatio: number): boolean {
	const hurt = me.getEnergy() < me.getMaxEnergy() * healingEnergyRatio;
	return hurt && canAfford(me, FightConstants.FIGHT_ACTIONS.PLAYER.ENERGETIC_ATTACK) || shouldPunishRest(me, opponent);
}
