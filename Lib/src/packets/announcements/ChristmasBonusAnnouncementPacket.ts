import { AnnouncementPacket } from "./AnnouncementPacket";

/**
 * Packet sent to announce the Christmas token bonus to all players
 */
export class ChristmasBonusAnnouncementPacket extends AnnouncementPacket {
	/**
	 * If true, this is a pre-announcement (a few hours before the bonus)
	 * If false, the bonus has been applied
	 */
	isPreAnnouncement!: boolean;
}
