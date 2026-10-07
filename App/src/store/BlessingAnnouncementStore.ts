import {BlessingActivatedRes} from "ws-packets/src/fromServer/character/BlessingActivatedRes";
import {PushedAnnouncementStore, usePushedAnnouncement} from "@/src/store/PushedAnnouncementStore";

/** The blessing just invoked for everyone. */
export const blessingAnnouncementStore = new PushedAnnouncementStore<BlessingActivatedRes>(BlessingActivatedRes.wireName);

export function useBlessingAnnouncement(): BlessingActivatedRes | null {
	return usePushedAnnouncement(blessingAnnouncementStore);
}
