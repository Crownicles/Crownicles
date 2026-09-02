import { Op } from "sequelize";
import { TournamentConstants } from "../../../../Lib/src/constants/TournamentConstants";
import {
	TournamentCategories, TournamentNotificationEvents, TournamentStatus, TournamentStatuses
} from "../../../../Lib/src/types/Tournament";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";
import {
	LockKey, withLockedEntities
} from "../../../../Lib/src/locks/withLockedEntities";
import { Tournament } from "../database/game/models/Tournament";
import { TournamentParticipant } from "../database/game/models/TournamentParticipant";
import Player from "../database/game/models/Player";
import {
	getCategoryCounts, getEndingNotificationDate, getTournamentRewardAmounts,
	PROCESSABLE_STATUSES, sortParticipants
} from "./TournamentRules";
import type { TournamentRewardRank } from "./TournamentTypes";
import {
	claimTournamentEvent, TournamentEventData
} from "./TournamentNotifications";

type TournamentRewardPreparationContext = {
	category: typeof TournamentCategories[keyof typeof TournamentCategories];
	participantCount: number;
	rankData: TournamentRewardRank;
};

type TournamentNotificationConfiguration = {
	isReady: (tournament: Tournament) => boolean;
	eventData: (tournament: Tournament) => TournamentEventData;
};

type TournamentParticipantId = TournamentParticipant["id"];

type TournamentParticipantSnapshot = {
	tournament: Tournament;
	participantIds: TournamentParticipantId[];
};

function prepareParticipantReward(
	participant: TournamentParticipant,
	context: TournamentRewardPreparationContext
): void {
	const rewardAmounts = getTournamentRewardAmounts(context.participantCount, context.category, context.rankData);
	participant.finalRank = context.rankData.rank;
	participant.isWinner = context.rankData.rank === 1;
	participant.rewardXp = rewardAmounts.experience;
	participant.rewardMoney = rewardAmounts.money;
	participant.rewardItemCount = rewardAmounts.itemCount;
}

class TournamentParticipantsChangedError extends Error {
}

function getLockedTournamentEntities(
	entities: readonly unknown[],
	participantIds: TournamentParticipantId[]
): {
	tournament: Tournament;
	participants: TournamentParticipant[];
} {
	const tournament = entities.find((entity): entity is Tournament => entity instanceof Tournament);
	const participants = entities.filter((entity): entity is TournamentParticipant => entity instanceof TournamentParticipant);
	if (!tournament || participants.length !== participantIds.length) {
		throw new TournamentParticipantsChangedError();
	}
	return {
		tournament,
		participants
	};
}

async function assertParticipantSnapshotIsCurrent(snapshot: TournamentParticipantSnapshot): Promise<void> {
	const participantIdSet = new Set(snapshot.participantIds);
	const currentParticipants = await TournamentParticipant.findAll({ where: { tournamentId: snapshot.tournament.id } });
	if (currentParticipants.some(participant => !participantIdSet.has(participant.id))) {
		throw new TournamentParticipantsChangedError();
	}
}

async function freezeTournamentAttempt(snapshot: TournamentParticipantSnapshot): Promise<void> {
	const lockKeys: LockKey[] = [
		Tournament.lockKey(snapshot.tournament.id),
		...snapshot.participantIds.map(participantId => TournamentParticipant.lockKey(participantId))
	];
	await withLockedEntities(lockKeys, async entities => {
		const {
			tournament,
			participants
		} = getLockedTournamentEntities(entities, snapshot.participantIds);
		await assertParticipantSnapshotIsCurrent({
			tournament,
			participantIds: snapshot.participantIds
		});
		if (tournament.status !== TournamentStatuses.COMBAT || Date.now() < tournament.combatEndsAt.getTime()) {
			return;
		}
		const players = await Player.findAll({
			where: { id: { [Op.in]: participants.map(participant => participant.playerId) } }
		});
		const playersById = new Map(players.map(player => [player.id, player]));
		const participantCount = participants.length;
		for (const category of Object.values(TournamentCategories)) {
			const categoryParticipants = sortParticipants(
				participants.filter(participant => participant.category === category),
				playersById,
				tournament
			);
			for (const [index, participant] of categoryParticipants.entries()) {
				prepareParticipantReward(participant, {
					category,
					participantCount,
					rankData: {
						rank: index + 1,
						categoryParticipantCount: categoryParticipants.length
					}
				});
				await participant.save();
			}
		}
		tournament.status = TournamentStatuses.COMPLETED;
		await tournament.save();
	});
}

async function advanceRegistration(tournament: Tournament): Promise<void> {
	let event: TournamentEventData | null = null;
	await Tournament.withLocked(tournament.id, async lockedTournament => {
		if (lockedTournament.status !== TournamentStatuses.REGISTRATION || Date.now() < lockedTournament.registrationEndsAt.getTime()) {
			return;
		}
		const participants = await TournamentParticipant.findAll({ where: { tournamentId: lockedTournament.id } });
		const categoryCounts = getCategoryCounts(participants);
		const hasEnoughParticipants = participants.length >= TournamentConstants.MINIMUM_TOTAL_PARTICIPANTS
			&& categoryCounts[TournamentCategories.LEVEL_50] >= TournamentConstants.MINIMUM_PARTICIPANTS_PER_CATEGORY
			&& categoryCounts[TournamentCategories.LEVEL_100] >= TournamentConstants.MINIMUM_PARTICIPANTS_PER_CATEGORY;
		if (!hasEnoughParticipants) {
			lockedTournament.status = TournamentStatuses.CANCELLED;
			lockedTournament.rewardsDistributed = true;
			lockedTournament.cancellationReason = "tooFewParticipants";
			event = {
				event: TournamentNotificationEvents.ENDED,
				cancellationReason: "tooFewParticipants"
			};
		}
		else {
			lockedTournament.status = TournamentStatuses.COMBAT;
			event = { event: TournamentNotificationEvents.STARTED };
		}
		await lockedTournament.save();
	});
	if (event) {
		await claimTournamentEvent(tournament.id, event);
	}
}

async function sendTournamentNotificationIfReady(
	tournament: Tournament,
	configuration: TournamentNotificationConfiguration
): Promise<void> {
	let shouldSend = false;
	let eventData: TournamentEventData | null = null;
	await Tournament.withLocked(tournament.id, lockedTournament => {
		if (!configuration.isReady(lockedTournament)) {
			return Promise.resolve();
		}
		eventData = configuration.eventData(lockedTournament);
		shouldSend = true;
		return Promise.resolve();
	});
	if (shouldSend) {
		await claimTournamentEvent(tournament.id, eventData!);
	}
}

function isEndingNotificationReady(tournament: Tournament): boolean {
	return tournament.status === TournamentStatuses.COMBAT
		&& Date.now() >= getEndingNotificationDate(tournament).getTime();
}

function isStartedNotificationReady(tournament: Tournament): boolean {
	return tournament.status === TournamentStatuses.COMBAT
		&& !tournament.startedNotificationSent;
}

function isEndedNotificationReady(tournament: Tournament): boolean {
	return (tournament.status === TournamentStatuses.COMPLETED || tournament.status === TournamentStatuses.CANCELLED)
		&& !tournament.endedNotificationSent;
}

function sendStartedNotificationIfNeeded(tournament: Tournament): Promise<void> {
	return sendTournamentNotificationIfReady(tournament, {
		isReady: isStartedNotificationReady,
		eventData: () => ({ event: TournamentNotificationEvents.STARTED })
	});
}

async function sendEndingNotificationIfDue(tournament: Tournament): Promise<void> {
	await sendTournamentNotificationIfReady(tournament, {
		isReady: isEndingNotificationReady,
		eventData: () => ({ event: TournamentNotificationEvents.ENDING })
	});
}

async function sendEndedNotificationIfReady(tournament: Tournament): Promise<void> {
	await sendTournamentNotificationIfReady(tournament, {
		isReady: isEndedNotificationReady,
		eventData: tournament => ({
			event: TournamentNotificationEvents.ENDED,
			cancellationReason: tournament.cancellationReason ?? undefined
		})
	});
}

async function freezeTournament(tournament: Tournament): Promise<void> {
	while (true) {
		const participantIds = (await TournamentParticipant.findAll({ where: { tournamentId: tournament.id } }))
			.map(participant => participant.id);
		try {
			await freezeTournamentAttempt({
				tournament,
				participantIds
			});
			return;
		}
		catch (error) {
			if (!(error instanceof TournamentParticipantsChangedError)) {
				throw error;
			}
		}
	}
}

async function finishTournament(tournament: Tournament): Promise<void> {
	await sendEndingNotificationIfDue(tournament);
	await freezeTournament(tournament);
	await sendEndedNotificationIfReady(tournament);
}

type DueTournamentHandler = (tournament: Tournament) => Promise<void>;

async function processRegistrationDeadline(tournament: Tournament): Promise<void> {
	if (Date.now() >= tournament.registrationEndsAt.getTime()) {
		await advanceRegistration(tournament);
	}
}

async function processCombatDeadline(tournament: Tournament): Promise<void> {
	await sendStartedNotificationIfNeeded(tournament);
	const processFinish = Date.now() >= tournament.combatEndsAt.getTime();
	await (processFinish ? finishTournament : sendEndingNotificationIfDue)(tournament);
}

async function processCompletedTournament(tournament: Tournament): Promise<void> {
	await sendEndedNotificationIfReady(tournament);
}

async function processCancelledTournament(tournament: Tournament): Promise<void> {
	await sendEndedNotificationIfReady(tournament);
}

const dueTournamentHandlers: Partial<Record<TournamentStatus, DueTournamentHandler>> = {
	[TournamentStatuses.REGISTRATION]: processRegistrationDeadline,
	[TournamentStatuses.COMBAT]: processCombatDeadline,
	[TournamentStatuses.COMPLETED]: processCompletedTournament,
	[TournamentStatuses.CANCELLED]: processCancelledTournament
};

async function processDueTournament(tournament: Tournament): Promise<void> {
	const handler = dueTournamentHandlers[tournament.status];
	if (handler) {
		await handler(tournament);
	}
}

export async function processDueTournaments(): Promise<void> {
	if (!Tournament.sequelize) {
		return;
	}
	const tournaments = await Tournament.findAll({
		where: { status: { [Op.in]: PROCESSABLE_STATUSES } }
	});
	for (const tournament of tournaments) {
		try {
			await processDueTournament(tournament);
		}
		catch (error) {
			CrowniclesLogger.errorWithObj(`Tournament ${tournament.id} processing failed`, error);
		}
	}
}
