import {
	makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	TournamentNotificationPacket
} from "../../../../Lib/src/packets/notifications/TournamentNotificationPacket";
import {
	TournamentAnnouncementEvents, TournamentChannelAnnouncementPacket
} from "../../../../Lib/src/packets/notifications/TournamentChannelAnnouncementPacket";
import {
	TournamentCancellationReason, TournamentCategories, TournamentCategory, TournamentNotificationEvent,
	TournamentNotificationEvents, TournamentStatuses
} from "../../../../Lib/src/types/Tournament";
import { PacketUtils } from "../utils/PacketUtils";
import TournamentParticipant from "../database/game/models/TournamentParticipant";
import Tournament from "../database/game/models/Tournament";
import {
	withLockedEntities
} from "../../../../Lib/src/locks/withLockedEntities";

const TEST_PLAYER_PREFIX = "tournament-test-";

type ClaimableTournamentEvent = Exclude<TournamentNotificationEvent, typeof TournamentNotificationEvents.PAUSED>;

export type TournamentEventData = {
	event: ClaimableTournamentEvent;
	cancellationReason?: TournamentCancellationReason;
};

const sentFieldByEvent = {
	[TournamentNotificationEvents.STARTED]: "startedNotificationSent",
	[TournamentNotificationEvents.ENDING]: "endingNotificationSent",
	[TournamentNotificationEvents.ENDED]: "endedNotificationSent"
} as const;

type TournamentNotificationSentField = typeof sentFieldByEvent[keyof typeof sentFieldByEvent];

type TournamentEventClaim = {
	tournament: Tournament;
	participants: TournamentParticipant[];
	firstClaim: boolean;
};

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

async function getParticipantIds(tournamentId: number): Promise<number[]> {
	const participants = await TournamentParticipant.findAll({ where: { tournamentId } });
	return participants.map(participant => participant.id);
}

type LockedNotificationEntities = {
	tournament: Tournament;
	participants: TournamentParticipant[];
};

function getLockedNotificationEntities(
	entities: readonly unknown[],
	participantCount: number
): LockedNotificationEntities {
	const tournament = entities.find((entity): entity is Tournament => entity instanceof Tournament);
	const participants = entities.filter((entity): entity is TournamentParticipant => entity instanceof TournamentParticipant);
	if (!tournament || participants.length !== participantCount) {
		throw new TournamentParticipantsChangedError();
	}
	return {
		tournament,
		participants
	};
}

async function claimTournamentEventAttempt(
	tournamentId: number,
	participantIds: number[],
	eventData: TournamentEventData
): Promise<TournamentEventClaim | null> {
	const participantLockKeys = participantIds.map(participantId => TournamentParticipant.lockKey(participantId));
	return await withLockedEntities(
		[
			...participantLockKeys,
			Tournament.lockKey(tournamentId)
		] as const,
		async entities => {
			const {
				tournament,
				participants
			} = getLockedNotificationEntities(entities, participantIds.length);
			if (!isEventApplicable(tournament.status, eventData.event)) {
				return null;
			}
			const currentParticipants = await TournamentParticipant.findAll({ where: { tournamentId } });
			if (hasParticipantSnapshotChanged(participantIds, currentParticipants)) {
				throw new TournamentParticipantsChangedError();
			}
			const sentField: TournamentNotificationSentField = sentFieldByEvent[eventData.event];
			const firstClaim = !tournament[sentField];
			const participantsToNotify = participants.filter(participant => !participant[sentField]);
			if (participantsToNotify.length === 0 && !firstClaim) {
				return null;
			}
			await Promise.all(participantsToNotify.map(async participant => {
				participant[sentField] = true;
				await participant.save();
			}));
			tournament[sentField] = true;
			await tournament.save();
			return {
				tournament,
				participants: participantsToNotify,
				firstClaim
			};
		}
	);
}

export async function claimTournamentEvent(
	tournamentId: number,
	eventData: TournamentEventData
): Promise<void> {
	while (true) {
		const participantIds = await getParticipantIds(tournamentId);
		try {
			const claim = await claimTournamentEventAttempt(tournamentId, participantIds, eventData);
			if (!claim) {
				return;
			}
			sendTournamentEvent(claim.tournament, claim.participants, eventData);
			if (claim.firstClaim) {
				await announceTournamentEvent(claim.tournament, eventData);
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

export function isTournamentTestPlayer(keycloakId: string): boolean {
	return keycloakId.startsWith(TEST_PLAYER_PREFIX);
}

function isTestTournament(participants: TournamentParticipant[]): boolean {
	return participants.some(participant => isTournamentTestPlayer(participant.keycloakId));
}

async function announceTournamentEvent(tournament: Tournament, eventData: TournamentEventData): Promise<void> {
	if (eventData.event === TournamentNotificationEvents.ENDING) {
		return;
	}
	const participants = await TournamentParticipant.findAll({ where: { tournamentId: tournament.id } });
	if (isTestTournament(participants)) {
		return;
	}
	const baseAnnouncement = {
		discordChannelId: tournament.discordChannelId,
		language: tournament.language,
		combatEndsAt: tournament.combatEndsAt.getTime()
	};
	let announcement: TournamentChannelAnnouncementPacket;
	if (eventData.event === TournamentNotificationEvents.STARTED) {
		announcement = {
			...baseAnnouncement,
			event: TournamentAnnouncementEvents.STARTED
		};
	}
	else if (tournament.status === TournamentStatuses.COMPLETED) {
		announcement = {
			...baseAnnouncement,
			event: TournamentAnnouncementEvents.COMPLETED,
			winners: participants
				.filter(participant => participant.isWinner)
				.map(participant => ({
					category: participant.category,
					keycloakId: participant.keycloakId
				}))
		};
	}
	else {
		announcement = {
			...baseAnnouncement,
			event: TournamentAnnouncementEvents.CANCELLED,
			...eventData.cancellationReason ? { cancellationReason: eventData.cancellationReason } : {}
		};
	}
	PacketUtils.sendNotifications([makePacket(TournamentChannelAnnouncementPacket, announcement)]);
}

export function sendTournamentEvent(
	tournament: Tournament,
	participants: TournamentParticipant[],
	eventData: {
		event: TournamentNotificationEvent;
		cancellationReason?: TournamentCancellationReason;
	}
): void {
	if (participants.length === 0 || isTestTournament(participants)) {
		return;
	}
	const winnersByCategory = new Map<TournamentCategory, string | undefined>(
		Object.values(TournamentCategories).map(category => [
			category,
			participants.find(participant => participant.category === category && participant.isWinner)?.keycloakId
		])
	);
	PacketUtils.sendNotifications(participants.map(participant => makePacket(TournamentNotificationPacket, {
		keycloakId: participant.keycloakId,
		event: eventData.event,
		tournamentId: tournament.id,
		category: participant.category,
		combatEndsAt: tournament.combatEndsAt.getTime(),
		winnerKeycloakId: winnersByCategory.get(participant.category),
		rank: participant.finalRank ?? undefined,
		xp: participant.rewardXp || undefined,
		money: participant.rewardMoney || undefined,
		itemCount: participant.rewardItemCount || undefined,
		cancellationReason: eventData.cancellationReason
	})));
}
