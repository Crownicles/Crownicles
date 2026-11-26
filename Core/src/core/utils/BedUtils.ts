import { HomeConstants } from "../../../../Lib/src/constants/HomeConstants";

/**
 * Every bed (home, apartment, inn room or a bed offered in a big event) shares one cooldown, started by `lastBedUsedAt`.
 * @param lastBedUsedAt - When the player last slept in a bed
 * @param now - The current date
 * @returns When a bed is available again, or null when it already is
 */
export function getNextBedAvailableAt(lastBedUsedAt: Date | null, now: Date): number | null {
	if (!lastBedUsedAt) {
		return null;
	}
	const nextAvailableAt = lastBedUsedAt.getTime() + HomeConstants.BED_COOLDOWN_MS;
	return nextAvailableAt > now.getTime() ? nextAvailableAt : null;
}
