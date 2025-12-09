import { PetConstants } from "../../../../Lib/src/constants/PetConstants";
import { generateRandomRarity } from "./ItemUtils";
import { PetExpeditions } from "../database/game/models/PetExpedition";
import Player from "../database/game/models/Player";
import { MathUtils } from "./MathUtils";

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

		/*
		 * Clone talisman is present - check if context allows clone usage
		 * Clone talisman allows pet in small events and defense fights, but NOT in attack fights
		 */
		return context === PetConstants.AVAILABILITY_CONTEXT.SMALL_EVENT
			|| context === PetConstants.AVAILABILITY_CONTEXT.DEFENSE_FIGHT;
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

		return await this.isPetOnExpedition(player.id);
	}

	/**
	 * Check if player's pet is currently on an expedition
	 *
	 * @param playerId - The player ID to check
	 * @returns true if the pet is on an expedition
	 */
	static async isPetOnExpedition(playerId: number): Promise<boolean> {
		const activeExpedition = await PetExpeditions.getActiveExpeditionForPlayer(playerId);
		return activeExpedition !== null;
	}

	/**
	 * Age categories sorted from youngest to oldest
	 */
	private static readonly AGE_CATEGORIES = [
		{
			threshold: PetConstants.PET_AGE_GROUPS_THRESHOLDS.ANCESTOR,
			name: PetConstants.PET_AGE_GROUP_NAMES.ANCESTOR
		},
		{
			threshold: PetConstants.PET_AGE_GROUPS_THRESHOLDS.VERY_OLD,
			name: PetConstants.PET_AGE_GROUP_NAMES.VERY_OLD
		},
		{
			threshold: PetConstants.PET_AGE_GROUPS_THRESHOLDS.OLD,
			name: PetConstants.PET_AGE_GROUP_NAMES.OLD
		},
		{
			threshold: PetConstants.PET_AGE_GROUPS_THRESHOLDS.ADULT,
			name: PetConstants.PET_AGE_GROUP_NAMES.ADULT
		}
	];

	/**
	 * Get age context depending on the id of the pet
	 * @param age - the id of the pet
	 * @returns a string context that can be used to get more precise translations
	 */
	static getAgeCategory(age: number): string {
		for (const category of this.AGE_CATEGORIES) {
			if (age <= category.threshold) {
				return category.name;
			}
		}
		return PetConstants.PET_AGE_GROUP_NAMES.OTHER;
	}

	static generateRandomPetRarity(
		minRarity = PetConstants.PET_RARITY_RANGE.MIN,
		maxRarity = PetConstants.PET_RARITY_RANGE.MAX
	): number {
		const clampedMin = MathUtils.clamp(minRarity, PetConstants.PET_RARITY_RANGE.MIN, PetConstants.PET_RARITY_RANGE.MAX);
		const clampedMax = MathUtils.clamp(maxRarity, clampedMin, PetConstants.PET_RARITY_RANGE.MAX);
		return generateRandomRarity(clampedMin, clampedMax);
	}

	static getPetVigor(pet: { force: number }, lovePoints = 0, options?: { enraged?: boolean }): number {
		if (options?.enraged) {
			return MathUtils.clamp(
				Math.round((pet.force * PetConstants.VIGOR.ENRAGED_MULTIPLIER) / PetConstants.VIGOR.DIVIDER),
				PetConstants.VIGOR.MIN,
				PetConstants.VIGOR.MAX
			);
		}
		const effectiveLovePoints = Math.min(lovePoints, PetConstants.TRAINED_LOVE_THRESHOLD);
		const vigorSource = effectiveLovePoints / PetConstants.VIGOR.LOVE_DIVIDER + pet.force;
		return MathUtils.clamp(
			Math.round(vigorSource / PetConstants.VIGOR.DIVIDER),
			PetConstants.VIGOR.MIN,
			PetConstants.VIGOR.MAX
		);
	}
}
