import { Fighter } from "../fights/fighter/Fighter";

/**
 * Utility functions for fight calculations
 */
export class FightUtils {
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
	 * Calculates pet attack based on an input value and level of the player
	 * @param petPower Raw power of the pet
	 * @param level The level multiplier
	 * @returns stat = level * petPower
	 */
	static calculatePetStatFromRawPower(petPower: number, level: number): number {
		return level * petPower;
	}
}
