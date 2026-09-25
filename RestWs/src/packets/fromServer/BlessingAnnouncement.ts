import { BlessingAnnouncementPacket } from "../../../../Lib/src/packets/announcements/BlessingAnnouncementPacket";
import { makeFromServerPacket } from "../../../../WsPackets/src/MakePackets";
import { BlessingActivatedRes } from "../../../../WsPackets/src/fromServer/character/BlessingActivatedRes";

/** Only what the app shows: contributors are named in Discord's announcement, not in a notification. */
export function translateBlessingAnnouncement(announcement: BlessingAnnouncementPacket): BlessingActivatedRes {
	return makeFromServerPacket(BlessingActivatedRes, {
		blessingType: announcement.blessingType,
		durationHours: announcement.durationHours
	});
}
