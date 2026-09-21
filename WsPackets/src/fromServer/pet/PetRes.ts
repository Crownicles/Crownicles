import { FromServerPacket } from "../FromServerPacket";
import { OwnedPet } from "../../objects/OwnedPet";
import { PetPower } from "../../objects/PetPower";

export const EXPEDITION_LOCATION_TYPES = {
	FOREST: "forest",
	MOUNTAIN: "mountain",
	DESERT: "desert",
	SWAMP: "swamp",
	RUINS: "ruins",
	CAVE: "cave",
	PLAINS: "plains",
	COAST: "coast"
} as const;

export type ExpeditionLocationType = typeof EXPEDITION_LOCATION_TYPES[keyof typeof EXPEDITION_LOCATION_TYPES];

/**
 * Expedition the pet is currently away on. Times are absolute timestamps, so the client can run a
 * countdown without a shared clock.
 */
export type PetExpedition = {
	startTime: number;
	endTime: number;
	riskRate: number;
	difficulty: number;
	locationType: ExpeditionLocationType;
	mapLocationId: number;
	foodConsumed: number;
	isDistantExpedition?: boolean;
};

export class PetPowersRes extends FromServerPacket {
	public static readonly wireName = "PetPowersRes";

	powers!: PetPower[];
}

export class PetRes extends FromServerPacket {
	public static readonly wireName = "PetRes";

	pet!: OwnedPet;

	/**
	 * Whether the player owns the talisman unlocking expeditions.
	 */
	hasTalisman?: boolean;

	/**
	 * When the pet is hungry again, as an absolute timestamp, so a meal can be refused before it is asked for.
	 */
	feedAvailableAt?: number;

	expeditionInProgress?: PetExpedition;
}
