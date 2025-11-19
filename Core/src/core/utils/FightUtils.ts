import { Fighter } from "../fights/fighter/Fighter";

/**
 * Utility functions for fight calculations
 */
export class FightUtils {
	private static readonly PET_FORCE_BALANCE = {
		AVERAGE_FORCE: 10.068627450980392,
		MAX_FORCE: 30,
		MIN_MULTIPLIER: 0.92,
		MAX_MULTIPLIER: 1.04,
		SQRT_SLOPE: 0.025
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
	 * @returns stat = level * (0.8 + force / 150)
	 */
	static calculatePetStatFromForce(petForce: number, level: number): number {
		const normalizedForce = Math.max(0, petForce);
		const {
			AVERAGE_FORCE,
			MAX_FORCE,
			MIN_MULTIPLIER,
			MAX_MULTIPLIER,
			SQRT_SLOPE
		} = FightUtils.PET_FORCE_BALANCE;
		const sqrtDelta = Math.sqrt(normalizedForce) - Math.sqrt(AVERAGE_FORCE);
		let multiplier = 1 + (sqrtDelta * SQRT_SLOPE);
		if (normalizedForce >= MAX_FORCE) {
			multiplier = Math.min(multiplier, 1);
		}
		multiplier = Math.min(MAX_MULTIPLIER, Math.max(MIN_MULTIPLIER, multiplier));
		return level * multiplier;
	}
}
