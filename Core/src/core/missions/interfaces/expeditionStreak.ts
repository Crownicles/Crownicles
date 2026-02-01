import { IMission } from "../IMission";
import { getDayNumber } from "../../../../../Lib/src/utils/TimeUtils";

export const missionInterface: IMission = {
	areParamsMatchingVariantAndBlob: () => true,

	generateRandomVariant: () => 0,

	initialNumberDone: () => 0,

	/**
	 * Store the current day number to track consecutive expeditions
	 * The streak is broken if the player fails an expedition
	 */
	updateSaveBlob: () => {
		const buffer = Buffer.alloc(4);
		buffer.writeInt32LE(getDayNumber());
		return buffer;
	}
};
