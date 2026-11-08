import { KingChallengeTierReachedRes } from "ws-packets/src/fromServer/missions/KingChallengeTierReachedRes";
import {
	PushedAnnouncementStore, usePushedAnnouncement
} from "@/src/store/PushedAnnouncementStore";

/** The last king's challenge crossing of the player's own character. */
export const kingChallengeTierStore = new PushedAnnouncementStore<KingChallengeTierReachedRes>(KingChallengeTierReachedRes.wireName, packet => packet.self);

export function useKingChallengeTierReached(): KingChallengeTierReachedRes | null {
	return usePushedAnnouncement(kingChallengeTierStore);
}
