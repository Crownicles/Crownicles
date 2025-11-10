import { MissionDifficulty } from "./MissionDifficulty";
import Player from "../database/game/models/Player";

export type MissionParams = {
	[key: string]: unknown;
};

export type IMission = {

	/**
	 * Generate a random variant of mission
	 * @param difficulty - the difficulty of the mission
	 * @param player - the player from which the mission is generated
	 */
	generateRandomVariant(difficulty: MissionDifficulty, player: Player): number;

	/**
	 * Check if the params are matching the variant
	 * @param variant - the variant of the mission
	 * @param params - the params of the mission
	 * @param saveBlob - some binary data to save in the mission
	 */
	areParamsMatchingVariantAndBlob(variant: number, params: MissionParams, saveBlob: Buffer): boolean;

	/**
	 * Get the advancement of the mission at the beginning of the mission (maybe the player has already done it)
	 * @param player - the player
	 * @param variant - the variant of the mission
	 */
	initialNumberDone(player: Player, variant: number): number | Promise<number>;

	/**
	 * Save data in the mission (for example the location the player has to travel to in a go there mission)
	 * @param variant - the variant of the mission
	 * @param saveBlob - the binary data to save
	 * @param params - identical to the update of the mission
	 */
	updateSaveBlob(variant: number, saveBlob: Buffer, params: MissionParams): Buffer;

	/**
	 * Whether to always update the saveBlob even when params don't match
	 * Default is false (only update when params match)
	 * Set to true for missions that need to initialize saveBlob on first relevant action
	 */
	alwaysUpdateBlob?: boolean;
};
