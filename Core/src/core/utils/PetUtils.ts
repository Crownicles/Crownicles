import { PetConstants } from "../../../../Lib/src/constants/PetConstants";
import { generateRandomRarity } from "./ItemUtils";
import { PetExpeditions } from "../database/game/models/PetExpedition";
import Player from "../database/game/models/Player";

/**
 * Context in which pet availability is being checked
 */
export type PetAvailabilityContext = (typeof PetConstants.AVAILABILITY_CONTEXT)[keyof typeof PetConstants.AVAILABILITY_CONTEXT];

export abstract class PetUtils {
	/**
	 * Check if the player's pet is available for use in the given context.
	 * - Pet is always unavailable if player has no pet or pet is on expedition (unless clone talisman allows it)
	 * - With clone talisman: pet is available for small events and defense fights while on expedition
	 * - Without clone talisman: pet is not available while on expedition
	 *
	 * @param player - The player to check
	 * @param context - The context in which pet availability is being checked
	 * @returns true if the pet is available for use
	 */
	static async isPetAvailable(player: Player, context: PetAvailabilityContext): Promise<boolean> {
		// No pet = not available
		if (!player.petId) {
			return false;
		}

		// Check if pet is on expedition
		const activeExpedition = await PetExpeditions.getActiveExpeditionForPlayer(player.id);
		if (!activeExpedition) {
			// Pet is not on expedition, so it's available
			return true;
		}

		// Pet is on expedition - check if clone talisman allows usage
		if (!player.hasCloneTalisman) {
			// No clone talisman = pet not available while on expedition
			return false;
		}

		// Clone talisman is present - check context
		switch (context) {
			case PetConstants.AVAILABILITY_CONTEXT.SMALL_EVENT:
				// Clone talisman allows pet in small events
				return true;
			case PetConstants.AVAILABILITY_CONTEXT.DEFENSE_FIGHT:
				// Clone talisman allows pet in defense fights
				return true;
			case PetConstants.AVAILABILITY_CONTEXT.ATTACK_FIGHT:
				// Clone talisman does NOT allow pet in attack fights
				return false;
			default:
				return false;
		}
	}

	/**
	 * Check if the player's pet is currently a "clone" (on expedition but accessible via clone talisman)
	 *
	 * @param player - The player to check
	 * @returns true if the pet is a clone (on expedition with clone talisman)
	 */
	static async isPetClone(player: Player): Promise<boolean> {
		if (!player.petId || !player.hasCloneTalisman) {
			return false;
		}

		const activeExpedition = await PetExpeditions.getActiveExpeditionForPlayer(player.id);
		return activeExpedition !== null;
	}

	/**
	 * Get age context depending on the id of the pet
	 * @param age - the id of the pet
	 * @returns a string context that can be used to get more precise translations
	 */
	static getAgeCategory(age: number): string {
		return age <= PetConstants.PET_AGE_GROUPS_THRESHOLDS.ANCESTOR
			? PetConstants.PET_AGE_GROUP_NAMES.ANCESTOR
			: age <= PetConstants.PET_AGE_GROUPS_THRESHOLDS.VERY_OLD
				? PetConstants.PET_AGE_GROUP_NAMES.VERY_OLD
				: age <= PetConstants.PET_AGE_GROUPS_THRESHOLDS.OLD
					? PetConstants.PET_AGE_GROUP_NAMES.OLD
					: age <= PetConstants.PET_AGE_GROUPS_THRESHOLDS.ADULT
						? PetConstants.PET_AGE_GROUP_NAMES.ADULT
						: PetConstants.PET_AGE_GROUP_NAMES.OTHER;
	}

	static generateRandomPetRarity(
		minRarity = PetConstants.PET_RARITY_RANGE.MIN,
		maxRarity = PetConstants.PET_RARITY_RANGE.MAX
	): number {
		const clampedMin = Math.max(PetConstants.PET_RARITY_RANGE.MIN, Math.min(PetConstants.PET_RARITY_RANGE.MAX, minRarity));
		const clampedMax = Math.max(clampedMin, Math.min(PetConstants.PET_RARITY_RANGE.MAX, maxRarity));
		return generateRandomRarity(clampedMin, clampedMax);
	}

	static getPetVigor(pet: { force: number }, lovePoints = 0, options?: { enraged?: boolean }): number {
		if (options?.enraged) {
			return Math.max(PetConstants.VIGOR.MIN, Math.min(PetConstants.VIGOR.MAX, Math.round((pet.force * PetConstants.VIGOR.ENRAGED_MULTIPLIER) / PetConstants.VIGOR.DIVIDER)));
		}
		const effectiveLovePoints = Math.min(lovePoints, PetConstants.TRAINED_LOVE_THRESHOLD);
		const vigorSource = effectiveLovePoints / PetConstants.VIGOR.LOVE_DIVIDER + pet.force;
		return Math.max(PetConstants.VIGOR.MIN, Math.min(PetConstants.VIGOR.MAX, Math.round(vigorSource / PetConstants.VIGOR.DIVIDER)));
	}
}
