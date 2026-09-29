import { PetExpeditions } from "../database/game/models/PetExpedition";
import {
	PetEntities, PetEntity
} from "../database/game/models/PetEntity";
import { Player } from "../database/game/models/Player";
import { Pet } from "../../data/Pet";
import { Maps } from "../maps/Maps";
import {
	ExpeditionConstants, ExpeditionStartBlocker
} from "../../../../Lib/src/constants/ExpeditionConstants";

/**
 * Why a pet at home cannot leave on an expedition right now, in the order it is checked, or null when it can
 * @param player
 * @param petEntity
 * @param petModel
 */
export function expeditionStartBlocker(player: Player, petEntity: PetEntity, petModel: Pet): ExpeditionStartBlocker | null {
	if (petEntity.lovePoints < ExpeditionConstants.REQUIREMENTS.MIN_LOVE_POINTS) {
		return ExpeditionConstants.ERROR_CODES.INSUFFICIENT_LOVE;
	}
	if (petEntity.getFeedCooldown(petModel) <= 0) {
		return ExpeditionConstants.ERROR_CODES.PET_HUNGRY;
	}
	return Maps.isOnContinent(player) ? null : ExpeditionConstants.ERROR_CODES.NOT_ON_CONTINENT;
}

/**
 * Context for expedition resolution validation - success case
 * Uses TypeScript utility types to infer the non-null return types of async database queries:
 * - Awaited<T> unwraps the Promise to get the resolved type
 * - ReturnType<typeof fn> gets the return type of the function
 * - NonNullable<T> removes null/undefined from the type
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
 * @param playerId - The player's database ID
 * @param petId - The pet's database ID (can be null if no pet)
 */
export async function validateExpeditionPrerequisites(
	playerId: number,
	petId: number | null
): Promise<ExpeditionValidationResult> {
	const activeExpedition = await PetExpeditions.getActiveExpeditionForPlayer(playerId);
	if (!activeExpedition) {
		return {
			success: false,
			errorCode: ExpeditionConstants.ERROR_CODES.NO_EXPEDITION
		};
	}

	if (!activeExpedition.hasEnded()) {
		return {
			success: false,
			errorCode: ExpeditionConstants.ERROR_CODES.EXPEDITION_NOT_COMPLETE
		};
	}

	const petEntity = await PetEntities.getById(petId);
	if (!petEntity) {
		return {
			success: false,
			errorCode: ExpeditionConstants.ERROR_CODES.NO_PET
		};
	}

	return {
		success: true,
		activeExpedition,
		petEntity
	};
}
