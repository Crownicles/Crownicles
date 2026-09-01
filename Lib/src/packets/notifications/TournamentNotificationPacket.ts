import { NotificationPacket } from "./NotificationPacket";
import {
	TournamentCategory, TournamentNotificationEvent
} from "../../types/Tournament";

export type TournamentNotificationItem = {
	itemId: number;
	itemLevel: number;
	itemEnchantmentId?: string | null;
};

export class TournamentNotificationPacket extends NotificationPacket {
	event!: TournamentNotificationEvent;

	tournamentId!: number;

	category!: TournamentCategory;

	participantCount!: number;

	categoryParticipantCount!: number;

	winnerKeycloakId?: string;

	rank?: number;

	xp?: number;

	money?: number;

	itemCount?: number;

	items?: TournamentNotificationItem[];

	cancellationReason?: string;
}