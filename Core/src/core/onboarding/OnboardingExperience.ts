import Player from "../database/game/models/Player";
import { OnboardingConstants } from "../../../../Lib/src/constants/OnboardingConstants";
import { isInKingCastle } from "./OnboardingZone";

/** Until the hour-long road to a first city, the king's castle only gives a hint of experience, so the first levels come at a calmer pace. */
export function reportExperience(player: Player, amount: number): number {
	return isInKingCastle(player)
		? Math.min(amount, OnboardingConstants.KING_CASTLE_MAX_REPORT_EXPERIENCE)
		: amount;
}
