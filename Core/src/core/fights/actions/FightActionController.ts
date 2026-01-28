import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";
import { Fighter } from "../fighter/Fighter";
import { FightActionStatus } from "../../../../../Lib/src/types/FightActionStatus";
import {
	defaultFightActionResult,
	FightActionBuff,
	FightActionResult,
	FightAlterationApplied,
	FightStatBuffed
} from "../../../../../Lib/src/types/FightActionResult";
import { MathUtils } from "../../utils/MathUtils";
import {
	FightAction, FightActionDataController
} from "../../../data/FightAction";
import { FightController } from "../FightController";
import { FightAlterationResult } from "../../../../../Lib/src/types/FightAlterationResult";
import {
	FightAlteration, FightAlterationDataController
} from "../../../data/FightAlteration";
import { PetAssistanceResult } from "../../../../../Lib/src/types/PetAssistanceResult";
import { PetAssistance } from "../../../data/PetAssistance";

export type attackInfo = {
	minDamage: number; averageDamage: number; maxDamage: number;
};
export type statsInfo = {
	attackerStats: number[]; defenderStats: number[]; statsEffect: number[];
};

export class FightActionController {
	/**
	 * Get the attack damage for a fight action
	 * @param statsInfo object containing three arrays:
	 * attackerStats - array of the stats to use for the attacker
	 * defenderStats - array of the stats to use for the defender
	 * statsEffect - array of ratios to apply to the stats
	 * @param attacker - The attacker (used to get the bonus ratio and damage multiplier)
	 * @param attackInfo - the attack info of the fight action
	 * @param ignoreMultiplier - ignore the damage multiplier
	 */
	static getAttackDamage(statsInfo: statsInfo, attacker: Fighter, attackInfo: attackInfo, ignoreMultiplier = false): number {
		const levelBonusRatio = this.getLevelBonusRatio(attacker.level);
		let attackDamage = 0;
		for (let i = 0; i < statsInfo.attackerStats.length; i++) {
			attackDamage += this.getAttackDamageByStat(statsInfo.attackerStats[i], statsInfo.defenderStats[i], attackInfo) * statsInfo.statsEffect[i];
		}

		// Add a random variation for 5% of the damage
		attackDamage = Math.round(attackDamage + attackDamage * RandomUtils.variationInt(FightConstants.DAMAGE_RANDOM_VARIATION) / 100);

		// Damage multiplier
		if (!ignoreMultiplier) {
			attackDamage *= attacker.getDamageMultiplier();
		}
		return Math.round(attackDamage * (1 + levelBonusRatio));
	}

	/**
	 * Apply a buff to a fighter
	 * @param result
	 * @param buff
	 * @param target
	 * @param origin
	 */
	static applyBuff(
		result: FightActionResult | FightAlterationResult | PetAssistanceResult,
		buff: FightActionBuff,
		target: Fighter,
		origin: FightAction | FightAlteration | PetAssistance | null | undefined
	): void {
		const originAction = (origin ?? null) as FightAction | null;
		switch (buff.stat) {
			case FightStatBuffed.ATTACK:
				target.applyAttackModifier({
					origin: originAction,
					operation: buff.operator,
					value: buff.value
				});
				break;
			case FightStatBuffed.DEFENSE:
				target.applyDefenseModifier({
					origin: originAction,
					operation: buff.operator,
					value: buff.value
				});
				break;
			case FightStatBuffed.SPEED:
				target.applySpeedModifier({
					origin: originAction,
					operation: buff.operator,
					value: buff.value
				});
				break;
			case FightStatBuffed.BREATH:
				target.addBreath(buff.value);
				break;
			case FightStatBuffed.ENERGY:
				target.heal(buff.value);
				break;
			case FightStatBuffed.DAMAGE:
				target.damage(buff.value);
				break;
			case FightStatBuffed.DAMAGE_BOOST:
				target.applyDamageMultiplier(buff.value, buff.duration ?? 1);
				break;
			default:
				return;
		}
		if (result.buffs === undefined) {
			result.buffs = [];
		}
		result.buffs.push(buff);
	}

	static applyAlteration(result: FightActionResult | PetAssistanceResult, fightAlteration: FightAlterationApplied, target: Fighter): void {
		const alterationData = FightAlterationDataController.instance.getById(fightAlteration.alteration);
		if (!alterationData) {
			return;
		}
		const alteration = target.newAlteration(alterationData);
		if (alteration.id !== fightAlteration.alteration) {
			return;
		}
		if (result.alterations === undefined) {
			result.alterations = [];
		}
		result.alterations.push(fightAlteration);
	}

	/**
	 * Return a value between 0 and 100, (more or less), representing the power of a stat
	 * here is the formula: f(x) = 100 * tanh(0.0023*x - 0.03) + 3
	 * (formula by Pokegali)
	 * @param stat
	 */
	static statToStatPower(stat: number): number {
		return 120 * Math.tanh(0.00123 * stat - 0.03) + 3;
	}

	/**
	 * Execute a critical hit on a fight action (return the damage)
	 * this function also checks if the attack has missed
	 * @param damageDealt
	 * @param criticalHitProbability
	 * @param failureProbability
	 */
	static applySecondaryEffects(damageDealt: number, criticalHitProbability: number, failureProbability: number): {
		damages: number;
		status: FightActionStatus;
	} {
		// First, we get a random %
		const randomValue = RandomUtils.randInt(0, 100);

		// Then we use this % to determine if the attack has missed or is a critical hit
		if (randomValue < criticalHitProbability) {
			return {
				damages: Math.round(damageDealt * FightConstants.CRITICAL_HIT_MULTIPLIER),
				status: FightActionStatus.CRITICAL
			};
		}
		if (randomValue < failureProbability + criticalHitProbability) {
			return {
				damages: Math.round(damageDealt * RandomUtils.crowniclesRandom.pick(FightConstants.FAILURE_DIVIDERS)),
				status: FightActionStatus.MISSED
			};
		}

		return {
			damages: damageDealt,
			status: FightActionStatus.NORMAL
		};
	}

	/**
	 * Function to use when a fight action uses a second attack within itself
	 * @param sender - the fighter that uses the attack
	 * @param receiver - the fighter that receives the attack
	 * @param chosenAttack - the attack to use, cannot be an alteration
	 * @param turn - the turn of the fight
	 * @param fight - the fight controller
	 */
	static useSecondAttack(sender: Fighter, receiver: Fighter, chosenAttack: FightAction, turn: number, fight: FightController): FightActionResult {
		if (chosenAttack.breath > sender.getBreath()) {
			if (Math.random() < FightConstants.OUT_OF_BREATH_FAILURE_PROBABILITY) {
				chosenAttack = FightActionDataController.instance.getById("outOfBreath")!;
			}
			else {
				sender.setBreath(0);
			}
		}
		else {
			sender.addBreath(-chosenAttack.breath);
		}

		// We now this will not be an alteration result
		const resultLaunched = chosenAttack.use(sender, receiver, turn, fight) as FightActionResult;
		const result = defaultFightActionResult();
		result.usedAction = {
			id: chosenAttack.id,
			result: resultLaunched
		};
		return result;
	}

	/**
	 * Get the variant from a fight action id
	 * @param idFightAction
	 */
	static fightActionIdToVariant(idFightAction: string): number {
		return FightActionDataController.instance.getById(idFightAction)!.missionVariant;
	}

	/**
	 * Get the fight action id from a variant
	 * @param variant
	 */
	static variantToFightActionId(variant: number): string | null {
		for (const fightActionId of FightActionDataController.instance.getAllKeys()) {
			if (this.fightActionIdToVariant(fightActionId) === variant) {
				return fightActionId;
			}
		}
		return null;
	}

	/**
	 * Get the amount of damage a fight action will deal from stats
	 * @param attackerStat
	 * @param defenderStat
	 * @param attackInfo
	 */
	private static getAttackDamageByStat(attackerStat: number, defenderStat: number, attackInfo: attackInfo): number {
		/*
		 * This function allows exacerbating the difference between the attacker stat and the defender stat
		 */
		const ratio = (this.statToStatPower(attackerStat) - this.statToStatPower(defenderStat)) / 50;

		let damage;
		if (ratio < 0) {
			// If the attacker is weaker than the defender, the damage is selected in under the average damage interval
			damage = Math.round(MathUtils.getIntervalValue(attackInfo.minDamage, attackInfo.averageDamage, 1 - Math.abs(ratio)));
		}
		else {
			// If the attacker is stronger than the defender, the damage is selected in over the average damage interval
			damage = Math.round(MathUtils.getIntervalValue(attackInfo.averageDamage, attackInfo.maxDamage, ratio));
		}

		// Return damage caped between max and min
		return damage > attackInfo.maxDamage ? attackInfo.maxDamage : damage < attackInfo.minDamage ? attackInfo.minDamage : damage;
	}

	/**
	 * Get the level bonus ratio for a level
	 * @param level - the level of the player
	 */
	private static getLevelBonusRatio(level: number): number {
		return MathUtils.getIntervalValue(FightConstants.PLAYER_LEVEL_MINIMAL_MALUS, FightConstants.PLAYER_LEVEL_MAXIMAL_BONUS, level / FightConstants.MAX_PLAYER_LEVEL_FOR_BONUSES) / 100;
	}
}
