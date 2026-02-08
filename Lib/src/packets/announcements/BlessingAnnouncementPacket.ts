import { AnnouncementPacket } from "./AnnouncementPacket";

export class BlessingAnnouncementPacket extends AnnouncementPacket {
	blessingType!: number;

	triggeredByKeycloakId!: string;

	durationHours!: number;
}
