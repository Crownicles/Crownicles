import {FightConstants} from "../../constants/FightConstants";
import {RandomUtils} from "../../utils/RandomUtils";
import {Fighter} from "../fighter/Fighter";
import {FightActionStatus} from "@Lib/src/interfaces/FightActionStatus";
import {FightActionBuff, FightActionResult, FightAlteration, FightStatBuffed} from "@Lib/src/interfaces/FightActionResult";
import {MathUtils} from "@Core/src/core/utils/MathUtils";
import {FightAction} from "@Core/src/data/FightAction";

declare const JsonReader: JsonModule;

type attackInfo = { minDamage: number, averageDamage: number, maxDamage: number };
type statsInfo = { attackerStats: number[], defenderStats: number[], statsEffect: number[] }

export class FightActionController {
	/**
	 * Get the attack damage for a fight action
	 * @param statsInfo object containing 3 arrays :
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
		// Add a random variation of 5% of the damage
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
	static applyBuff(result: FightActionResult, buff: FightActionBuff, target: Fighter, origin: FightAction): void {
		switch (buff.stat) {
		case FightStatBuffed.ATTACK:
			target.applyAttackModifier({
				origin,
				operation: buff.operator,
				value: buff.value
			});
			break;
		case FightStatBuffed.DEFENSE:
			target.applyDefenseModifier({
				origin,
				operation: buff.operator,
				value: buff.value
			});
			break;
		case FightStatBuffed.SPEED:
			target.applySpeedModifier({
				origin,
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
		}
		if (result.buffs === undefined) {
			result.buffs = [];
		}
		result.buffs.push(buff);
	}

	static applyAlteration(result: FightActionResult, fightAlteration: FightAlteration, target: Fighter): void {
		const alteration = target.newAlteration(fightAlteration.alteration);
		if (alteration !== fightAlteration.alteration) {
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
		return 100 * Math.tanh(0.0023 * stat - 0.03) + 3;
	}

	/**
	 * Execute a critical hit on a fight action (return the damage)
	 * this function also check if the attack has missed
	 * @param damageDealt
	 * @param criticalHitProbability
	 * @param failureProbability
	 */
	static applySecondaryEffects(damageDealt: number, criticalHitProbability: number, failureProbability: number): { damages: number, status: FightActionStatus } {
		// First we get a random %
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
				damages: Math.round(damageDealt * RandomUtils.draftbotRandom.pick(FightConstants.FAILURE_DIVIDERS)),
				status: FightActionStatus.MISSED
			};
		}

		return {
			damages: damageDealt,
			status: FightActionStatus.NORMAL
		};
	}

	/**
	 * Get the variant from a fight action id
	 * @param idFightAction
	 */
	static fightActionIdToVariant(idFightAction: string): number {
		return Data.getModule(`fightactions.${idFightAction}`)
			.getNumber("missionVariant");
	}

	/**
	 * Get the fight action id from a variant
	 * @param variant
	 */
	static variantToFightActionId(variant: number): string {
		for (const fightActionId of Object.keys(JsonReader.fightactions)) {
			if (Data.getModule(`fightactions.${fightActionId}`)
				.getNumber("missionVariant") === variant) {
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
		 * This function allows to exacerbate the difference between the attacker stat and the defender stat
		 */
		const ratio = (this.statToStatPower(attackerStat) - this.statToStatPower(defenderStat)) / 50;

		const damage = ratio < 0 ? Math.round(
			// If the attacker is weaker than the defender, the damage is selected in the under the average damage interval
			MathUtils.getIntervalValue(attackInfo.minDamage, attackInfo.averageDamage, 1 - Math.abs(ratio))
		) : Math.round(
			// If the attacker is stronger than the defender, the damage is selected in the over the average damage interval
			MathUtils.getIntervalValue(attackInfo.averageDamage, attackInfo.maxDamage, ratio)
		);
		// Return damage caped between max and min
		return damage > attackInfo.maxDamage ? attackInfo.maxDamage : damage < attackInfo.minDamage ? attackInfo.minDamage : damage;
	}

	/**
	 * Get the level bonus ratio for a level
	 * @private
	 * @param level - the level of the player
	 */
	private static getLevelBonusRatio(level: number): number {
		return MathUtils.getIntervalValue(FightConstants.PLAYER_LEVEL_MINIMAL_MALUS, FightConstants.PLAYER_LEVEL_MAXIMAL_BONUS, level / FightConstants.MAX_PLAYER_LEVEL_FOR_BONUSES) / 100;
	}
}