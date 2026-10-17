import { NotificationPacket } from "./NotificationPacket";
import {
	TournamentCancellationReason, TournamentCategory, TournamentNotificationEvent
} from "../../types/Tournament";

export class TournamentNotificationPacket extends NotificationPacket {
	event!: TournamentNotificationEvent;

	tournamentId!: number;

	category!: TournamentCategory;

	combatEndsAt!: number;

	winnerKeycloakId?: string;

	rank?: number;

	xp?: number;

	money?: number;

	itemCount?: number;

	cancellationReason?: TournamentCancellationReason;
}
