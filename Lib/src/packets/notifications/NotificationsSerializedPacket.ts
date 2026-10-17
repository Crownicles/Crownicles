import { NotificationPacket } from "./NotificationPacket";
import { TournamentChannelAnnouncementPacket } from "./TournamentChannelAnnouncementPacket";

export type SerializableNotification = NotificationPacket | TournamentChannelAnnouncementPacket;

export interface NotificationsSerializedPacket {
	notifications: {
		type: string;

		packet: SerializableNotification;
	}[];
}
