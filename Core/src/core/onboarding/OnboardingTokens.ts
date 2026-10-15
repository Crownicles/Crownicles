import Player from "../database/game/models/Player";
import { isInKingCastle } from "./OnboardingZone";

/** A newcomer never meets the token merchant in the king's castle: the way to spend tokens only shows once they hold enough. */
export function hidesTokenOffer(player: Player, canAfford: boolean): boolean {
	return !canAfford && isInKingCastle(player);
}
