import { PetExpeditions } from "../database/game/models/PetExpedition";
import { PetEntities } from "../database/game/models/PetEntity";

/**
 * Context for expedition resolution validation - success case
 */
export interface ExpeditionValidationSuccess {
	success: true;
	activeExpedition: NonNullable<Awaited<ReturnType<typeof PetExpeditions.getActiveExpeditionForPlayer>>>;
	petEntity: NonNullable<Awaited<ReturnType<typeof PetEntities.getById>>>;
}

/**
 * Context for expedition resolution validation - failure case
 */
export interface ExpeditionValidationFailure {
	success: false;
	errorCode: string;
}

export type ExpeditionValidationResult = ExpeditionValidationSuccess | ExpeditionValidationFailure;

/**
 * Validate expedition prerequisites before resolution
 */
export async function validateExpeditionPrerequisites(
	playerId: number,
	petId: number | null
): Promise<ExpeditionValidationResult> {
	const activeExpedition = await PetExpeditions.getActiveExpeditionForPlayer(playerId);
	if (!activeExpedition) {
		return {
			success: false,
			errorCode: "noExpedition"
		};
	}

	if (!activeExpedition.hasEnded()) {
		return {
			success: false,
			errorCode: "expeditionNotComplete"
		};
	}

	if (!petId) {
		return {
			success: false,
			errorCode: "noPet"
		};
	}

	const petEntity = await PetEntities.getById(petId);
	if (!petEntity) {
		return {
			success: false,
			errorCode: "noPet"
		};
	}

	return {
		success: true,
		activeExpedition,
		petEntity
	};
}
