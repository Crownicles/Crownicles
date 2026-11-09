import { ReportDestinationRes } from "ws-packets/src/fromServer/report/ReportDestinationRes";
import {
	PushedAnnouncementStore, usePushedAnnouncement
} from "@/src/store/PushedAnnouncementStore";

/** The points a city stay earned, credited as the player leaves the city; a trip that starts elsewhere has nothing to announce. */
export const cityStayScoreStore = new PushedAnnouncementStore<ReportDestinationRes>(ReportDestinationRes.wireName, packet => Boolean(packet.cityStayScore));

export function useCityStayScore(): ReportDestinationRes | null {
	return usePushedAnnouncement(cityStayScoreStore);
}
