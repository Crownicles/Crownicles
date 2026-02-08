import { AnnouncementPacket } from "./AnnouncementPacket";

export class BlessingAnnouncementPacket extends AnnouncementPacket {
	blessingType!: number;

	triggeredByKeycloakId!: string;

	durationHours!: number;

	topContributorKeycloakId!: string;

	topContributorAmount!: number;

	totalContributors!: number;
}
