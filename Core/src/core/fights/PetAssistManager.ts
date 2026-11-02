import {
	PetAssistance, PetAssistanceDataController
} from "../../data/PetAssistance";
import { PetConstants } from "../../../../Lib/src/constants/PetConstants";

// Powers of each pet type, in the order they are triggered
const petAssistanceList = new Map<number, PetAssistance[]>();

/**
 * Initialize all pet behaviors in a map so they can be accessed by pet ID.
 * The first powers are registered before the secondary ones so they are triggered first
 */
export function initializeAllPetBehaviors(): void {
	petAssistanceList.clear();
	for (const mapping of [...PetConstants.PET_BEHAVIORS, ...PetConstants.PET_SECONDARY_BEHAVIORS]) {
		const behavior = PetAssistanceDataController.instance.getById(mapping.behaviorId)!;
		mapping.petIds.forEach(petId => registerPetBehavior(petId, behavior));
	}
}

/**
 * Register a pet behavior, after the ones already registered for this pet
 * @param petId The pet ID
 * @param behavior The behavior implementation
 */
export function registerPetBehavior(petId: number, behavior: PetAssistance): void {
	const behaviors = petAssistanceList.get(petId);
	if (behaviors) {
		behaviors.push(behavior);
		return;
	}
	petAssistanceList.set(petId, [behavior]);
}

/**
 * Get the powers of a pet type, in the order they are triggered
 * @param petId The pet ID
 * @returns The pet behaviors, empty if the pet has none
 */
export function getPetBehaviors(petId: number): PetAssistance[] {
	return petAssistanceList.get(petId) ?? [];
}
