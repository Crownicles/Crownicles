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
export const PET_SALE_ROLES = {
	SELLER: "seller", BUYER: "buyer", OBSERVER: "observer"
} as const;
export type PetSaleRole = typeof PET_SALE_ROLES[keyof typeof PET_SALE_ROLES];
export type PetSaleOffer = {
	pet: OwnedPet; price: number; role: PetSaleRole; sellerName?: string; buyerName?: string;
};
export const PET_MANAGEMENT_ERRORS = {
	BUSY: "busy",
	CANCELLED: "cancelled",
	CHANGED: "changed",
	NO_PET: "noPet",
	FEISTY: "feisty",
	EXPEDITION: "expedition",
	NO_GUILD: "noGuild",
	SELF: "self",
	SAME_GUILD: "sameGuild",
	HAS_PET: "hasPet",
	OWNER_ONLY: "ownerOnly",
	NO_BUYER: "noBuyer"
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
		type: "sold"; pet: OwnedPet; guildName: string; treasuryEarned: number;
	}
	| {
		type: "salePrice"; minPrice: number; maxPrice: number;
	}
	| {
		type: "saleFunds"; missingMoney: number;
	}
	| {
		type: "error"; error: PetManagementError;
	};
