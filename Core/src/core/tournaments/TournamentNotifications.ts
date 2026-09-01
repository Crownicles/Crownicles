import {
	makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	TournamentNotificationPacket
} from "../../../../Lib/src/packets/notifications/TournamentNotificationPacket";
import {
	TournamentCategories, TournamentCategory, TournamentNotificationEvents
} from "../../../../Lib/src/types/Tournament";
import { PacketUtils } from "../utils/PacketUtils";
import TournamentParticipant from "../database/game/models/TournamentParticipant";
import { getCategoryCounts } from "./TournamentRules";

export type TournamentEventData = {
	event: typeof TournamentNotificationEvents[keyof typeof TournamentNotificationEvents];
	cancellationReason?: string;
};

export function sendTournamentEvent(
	tournamentId: number,
	participants: TournamentParticipant[],
	eventData: TournamentEventData
): void {
	if (participants.length === 0) {
		return;
	}
	const categoryCounts = getCategoryCounts(participants);
	const winnersByCategory = new Map<TournamentCategory, string | undefined>(
		Object.values(TournamentCategories).map(category => [
			category,
			participants.find(participant => participant.category === category && participant.isWinner)?.keycloakId
		])
	);
	PacketUtils.sendNotifications(participants.map(participant => makePacket(TournamentNotificationPacket, {
		keycloakId: participant.keycloakId,
		event: eventData.event,
		tournamentId,
		category: participant.category,
		participantCount: participants.length,
		categoryParticipantCount: categoryCounts[participant.category],
		winnerKeycloakId: winnersByCategory.get(participant.category),
		rank: participant.finalRank ?? undefined,
		xp: participant.rewardXp || undefined,
		money: participant.rewardMoney || undefined,
		itemCount: participant.rewardItemCount || undefined,
		cancellationReason: eventData.cancellationReason
	})));
}
