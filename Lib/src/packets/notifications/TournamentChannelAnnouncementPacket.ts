import {
	TournamentCancellationReason, TournamentCategory
} from "../../types/Tournament";
import { Language } from "../../Language";

export const TournamentAnnouncementEvents = {
	STARTED: "started",
	COMPLETED: "completed",
	CANCELLED: "cancelled"
} as const;

export type TournamentAnnouncementEvent = typeof TournamentAnnouncementEvents[keyof typeof TournamentAnnouncementEvents];

export type TournamentCategoryWinner = {
	category: TournamentCategory;
	keycloakId: string;
};

/**
 * Public message posted in the tournament channel, routed through the notifications topic so it survives a front restart
 */
export class TournamentChannelAnnouncementPacket {
	event!: TournamentAnnouncementEvent;

	discordChannelId!: string;

	language!: Language;

	combatEndsAt!: number;

	winners?: TournamentCategoryWinner[];

	cancellationReason?: TournamentCancellationReason;
}
