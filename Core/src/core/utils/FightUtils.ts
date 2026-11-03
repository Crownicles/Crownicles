import { Fighter } from "../fights/fighter/Fighter";
import { PlayerBaseFighter } from "../fights/fighter/PlayerBaseFighter";
import { PetDataController } from "../../data/Pet";
import type { statsInfo } from "../fights/actions/FightActionController";

/**
 * Fight stats of a pet, scaled on the level of its owner
 */
export type PetFightStats = {
	force: number;
	speed: number;
};

/**
 * Utility functions for fight calculations
 */
export abstract class FightUtils {
	private static readonly PET_FORCE_BALANCE = {
		COEFF_QUADRATIC: 0.005,
		COEFF_LINEAR: 0.15
	};

	// Usual weighting of a pet attack: its force against the target's defense, a bit of its speed against the target's speed
	private static readonly PET_ATTACK_FORCE_EFFECT = 0.9;

	private static readonly PET_ATTACK_SPEED_EFFECT = 0.1;

	private static readonly PET_SPEED_BALANCE = {
		COEFF_QUADRATIC: 0.005,
		COEFF_LINEAR: 0.15
	};

	/**
	 * Use for petAssist effects to determine if the pet effect should be skipped.
	 * this is used for pet that put their effect at the start of the fight
	 * @param turn - the current turn of the fight
	 * @param opponent - the opponent fighter
	 */
	static shouldSkipPetEffect(turn: number, opponent: Fighter): boolean {
		return turn > 3 || turn === 1 || opponent.hasFightAlteration();
	}

	/**
	 * Calculates pet attack based on the force of the pet and level of the player
	 * @param petForce Force of the pet
	 * @param level The level multiplier
	 * @returns stat = level * (0.005 * force^2 + 0.15 * force)
	 */
	static calculatePetStatFromForce(petForce: number, level: number): number {
		const clampedForce = Math.max(0, petForce);
		const {
			COEFF_QUADRATIC,
			COEFF_LINEAR
		} = FightUtils.PET_FORCE_BALANCE;
		return level * clampedForce * (COEFF_QUADRATIC * clampedForce + COEFF_LINEAR);
	}

	/**
	 * Calculates pet speed stat based on the speed of the pet and level of the player
	 * @param petSpeed Speed of the pet
	 * @param level The level multiplier
	 * @returns stat = level * (0.005 * speed^2 + 0.15 * speed)
	 */
	static calculatePetStatFromSpeed(petSpeed: number, level: number): number {
		const clampedSpeed = Math.max(0, petSpeed);
		const {
			COEFF_QUADRATIC,
			COEFF_LINEAR
		} = FightUtils.PET_SPEED_BALANCE;
		return level * clampedSpeed * (COEFF_QUADRATIC * clampedSpeed + COEFF_LINEAR);
	}

	/**
	 * Get the fight stats of the pet assisting a fighter
	 * @param owner The fighter the pet belongs to, it must have a pet
	 */
	static getPetFightStats(owner: Fighter): PetFightStats {
		const petData = PetDataController.instance.getById((owner as PlayerBaseFighter).pet!.typeId)!;
		return {
			force: FightUtils.calculatePetStatFromForce(petData.force, owner.level),
			speed: FightUtils.calculatePetStatFromSpeed(petData.speed, owner.level)
		};
	}

	/**
	 * Get the stats used for a usual attack of the pet of a fighter
	 * @param owner The fighter the pet belongs to, it must have a pet
	 * @param target The fighter attacked by the pet
	 */
	static getPetAttackStatsInfo(owner: Fighter, target: Fighter): statsInfo {
		const petStats = FightUtils.getPetFightStats(owner);
		return {
			attackerStats: [
				petStats.force,
				petStats.speed
			],
			defenderStats: [
				target.getDefense(),
				target.getSpeed()
			],
			statsEffect: [
				FightUtils.PET_ATTACK_FORCE_EFFECT,
				FightUtils.PET_ATTACK_SPEED_EFFECT
			]
		};
	}
}
