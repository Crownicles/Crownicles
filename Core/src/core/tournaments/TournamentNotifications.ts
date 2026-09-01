import {
	makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	TournamentNotificationPacket
} from "../../../../Lib/src/packets/notifications/TournamentNotificationPacket";
import {
	TournamentCategories, TournamentCategory, TournamentNotificationEvents, TournamentStatuses
} from "../../../../Lib/src/types/Tournament";
import { PacketUtils } from "../utils/PacketUtils";
import TournamentParticipant from "../database/game/models/TournamentParticipant";
import Tournament from "../database/game/models/Tournament";
import {
	withLockedEntities
} from "../../../../Lib/src/locks/withLockedEntities";
import { getCategoryCounts } from "./TournamentRules";

export type TournamentEventData = {
	event: typeof TournamentNotificationEvents[keyof typeof TournamentNotificationEvents];
	cancellationReason?: string;
};

const sentFieldByEvent = {
	[TournamentNotificationEvents.STARTED]: "startedNotificationSent",
	[TournamentNotificationEvents.ENDING]: "endingNotificationSent",
	[TournamentNotificationEvents.ENDED]: "endedNotificationSent"
} as const;

type TournamentNotificationSentField = typeof sentFieldByEvent[keyof typeof sentFieldByEvent];

class TournamentParticipantsChangedError extends Error {
}

function isEventApplicable(
	status: Tournament["status"],
	event: TournamentEventData["event"]
): boolean {
	if (event === TournamentNotificationEvents.ENDED) {
		return status === TournamentStatuses.COMPLETED || status === TournamentStatuses.CANCELLED;
	}
	return status === TournamentStatuses.COMBAT;
}

function hasParticipantSnapshotChanged(expectedIds: number[], currentParticipants: TournamentParticipant[]): boolean {
	if (expectedIds.length !== currentParticipants.length) {
		return true;
	}
	const expectedIdSet = new Set(expectedIds);
	return currentParticipants.some(participant => !expectedIdSet.has(participant.id));
}

export async function claimTournamentEvent(
	tournamentId: number,
	eventData: TournamentEventData
): Promise<void> {
	while (true) {
		const participants = await TournamentParticipant.findAll({ where: { tournamentId } });
		if (participants.length === 0) {
			return;
		}
		const participantIds = participants.map(participant => participant.id);
		const participantLockKeys = participantIds.map(participantId => TournamentParticipant.lockKey(participantId));
		try {
			const lockedParticipants = await withLockedEntities(
				[
					...participantLockKeys,
					Tournament.lockKey(tournamentId)
				] as const,
				async entities => {
					const sentField: TournamentNotificationSentField = sentFieldByEvent[eventData.event];
					const lockedTournament = entities.find(entity => entity instanceof Tournament);
					const participantEntities = entities
						.filter((entity): entity is TournamentParticipant => entity instanceof TournamentParticipant);
					if (!lockedTournament || participantEntities.length !== participantIds.length) {
						throw new TournamentParticipantsChangedError();
					}
					if (!isEventApplicable(lockedTournament.status, eventData.event)) {
						return [];
					}
					const currentParticipants = await TournamentParticipant.findAll({ where: { tournamentId } });
					if (hasParticipantSnapshotChanged(participantIds, currentParticipants)) {
						throw new TournamentParticipantsChangedError();
					}
					const participantsToNotify = participantEntities.filter(participant => !participant[sentField]);
					if (participantsToNotify.length === 0) {
						return [];
					}
					await Promise.all(participantsToNotify.map(async participant => {
						participant[sentField] = true;
						await participant.save();
					}));
					lockedTournament[sentField] = true;
					await lockedTournament.save();
					return participantsToNotify;
				}
			);
			if (lockedParticipants.length > 0) {
				sendTournamentEvent(tournamentId, lockedParticipants, eventData);
			}
			return;
		}
		catch (error) {
			if (!(error instanceof TournamentParticipantsChangedError)) {
				throw error;
			}
		}
	}
}

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
