import { KingChallengeTierReachedRes } from "ws-packets/src/fromServer/missions/KingChallengeTierReachedRes";
import {
	PushedAnnouncementStore, usePushedAnnouncement
} from "@/src/store/PushedAnnouncementStore";

/**
 * A gain can cross a tier whose rewards complete a mission, whose points cross the next one: Core then pushes a
 * crossing for each. Following crossings told by the same toast add up; a crossing starting a new week replaces them.
 */
function mergeCrossings(pending: KingChallengeTierReachedRes, next: KingChallengeTierReachedRes): KingChallengeTierReachedRes {
	if (next.tier - next.crossedTiers !== pending.tier) {
		return next;
	}
	return {
		...next,
		crossedTiers: pending.crossedTiers + next.crossedTiers,
		reward: {
			money: pending.reward.money + next.reward.money,
			tokens: pending.reward.tokens + next.reward.tokens,
			gems: pending.reward.gems + next.reward.gems
		}
	};
}

/** The king's challenge crossings of the player's own character not yet announced. */
export const kingChallengeTierStore = new PushedAnnouncementStore<KingChallengeTierReachedRes>(KingChallengeTierReachedRes.wireName, packet => packet.self, mergeCrossings);

export function useKingChallengeTierReached(): KingChallengeTierReachedRes | null {
	return usePushedAnnouncement(kingChallengeTierStore);
}
