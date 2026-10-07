import {PlayerLevelUpRes} from "ws-packets/src/fromServer/character/PlayerLevelUpRes";
import {PushedAnnouncementStore, usePushedAnnouncement} from "@/src/store/PushedAnnouncementStore";

/** The last level the player reached; a gain of several levels at once shows the highest. */
export const levelUpStore = new PushedAnnouncementStore<PlayerLevelUpRes>(PlayerLevelUpRes.wireName, packet => packet.self);

export function useLevelUp(): PlayerLevelUpRes | null {
	return usePushedAnnouncement(levelUpStore);
}
