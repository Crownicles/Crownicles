import { PetConstants } from "../../../../Lib/src/constants/PetConstants";
import { generateRandomRarity } from "./ItemUtils";

export abstract class PetUtils {
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
