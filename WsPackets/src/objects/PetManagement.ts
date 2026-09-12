import { OwnedPet } from "./OwnedPet";
import { PetBasicInfo } from "./PetExpedition";

export type ShelterPet = {
	petEntityId: number; pet: OwnedPet;
};
export type ShelterChoices = {
	ownPet?: OwnedPet; shelterPets: ShelterPet[];
};
export type PetFreeConfirmation = {
	pet: PetBasicInfo; freeCost: number; isFromShelter: boolean;
};
export type PetFreeStatus = {
	foundPet: boolean; petCanBeFreed?: boolean; missingMoney?: number; cooldownRemainingTimeMs?: number; petOnExpedition?: boolean;
};
export const PET_MANAGEMENT_ERRORS = {
	BUSY: "busy", CANCELLED: "cancelled", CHANGED: "changed", NO_PET: "noPet", FEISTY: "feisty", EXPEDITION: "expedition"
} as const;
export type PetManagementError = typeof PET_MANAGEMENT_ERRORS[keyof typeof PET_MANAGEMENT_ERRORS];
export type PetManagementOutcome =
	| {
		type: "transfer"; oldPet?: OwnedPet; newPet?: OwnedPet;
	}
	| {
		type: "freeStatus"; status: PetFreeStatus;
	}
	| {
		type: "freed"; pet: PetBasicInfo; freeCost: number; luckyMeat: boolean; isFromShelter: boolean;
	}
	| {
		type: "error"; error: PetManagementError;
	};
