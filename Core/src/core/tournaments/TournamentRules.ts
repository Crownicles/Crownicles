import { TournamentConstants } from "../../../../Lib/src/constants/TournamentConstants";
import {
	TournamentCategories, TournamentCategory, TournamentNotificationEvents,
	TournamentStatuses, TournamentTopCategory
} from "../../../../Lib/src/types/Tournament";
import {
	asHours, hoursToMilliseconds
} from "../../../../Lib/src/utils/TimeUtils";
import type Tournament from "../database/game/models/Tournament";
import type TournamentParticipant from "../database/game/models/TournamentParticipant";
import type Player from "../database/game/models/Player";
import type { EloGameResult } from "../../../../Lib/src/types/EloGameResult";

export type TournamentStatusData = {
	tournamentId: number;
	status: typeof TournamentStatuses[keyof typeof TournamentStatuses];
	registrationEndsAt: number;
	combatEndsAt: number;
	participantCount: number;
	categoryCounts: Record<TournamentCategory, number>;
	category?: TournamentCategory;
	attackGloryPoints?: number;
	defenseGloryPoints?: number;
};

export type TournamentTopData = {
	tournamentId: number;
	categories: TournamentTopCategory[];
	pageNumber: number;
	totalPages: number;
	elementsPerPage: number;
};

export type TournamentEventData = {
	event: typeof TournamentNotificationEvents[keyof typeof TournamentNotificationEvents];
	cancellationReason?: string;
};

export const ACTIVE_STATUSES = [
	TournamentStatuses.REGISTRATION,
	TournamentStatuses.COMBAT,
	TournamentStatuses.PAUSED
];

export const CONTEXT_STATUSES = [
	...ACTIVE_STATUSES,
	TournamentStatuses.COMPLETED,
	TournamentStatuses.CANCELLED
];

export const PROCESSABLE_STATUSES = [
	TournamentStatuses.REGISTRATION,
	TournamentStatuses.COMBAT,
	TournamentStatuses.COMPLETED
];

export function getCategoryForLevel(level: number): TournamentCategory {
	return level >= 100 ? TournamentCategories.LEVEL_100 : TournamentCategories.LEVEL_50;
}

export function getEffectiveLevel(category: TournamentCategory, level: number): number {
	return Math.min(level, category === TournamentCategories.LEVEL_50 ? 50 : 100);
}

export function getCategoryCounts(participants: TournamentParticipant[]): Record<TournamentCategory, number> {
	return {
		[TournamentCategories.LEVEL_50]: participants.filter(participant => participant.category === TournamentCategories.LEVEL_50).length,
		[TournamentCategories.LEVEL_100]: participants.filter(participant => participant.category === TournamentCategories.LEVEL_100).length
	};
}

export function getRewardMultiplier(participantCount: number, category: TournamentCategory): number {
	const baseMultiplier = TournamentConstants.MINIMUM_REWARD_MULTIPLIER
		+ Math.floor((participantCount - TournamentConstants.MINIMUM_TOTAL_PARTICIPANTS) / TournamentConstants.REWARD_MULTIPLIER_PARTICIPANT_STEP);
	return category === TournamentCategories.LEVEL_50
		? baseMultiplier / TournamentConstants.LEVEL_50_REWARD_DIVISOR
		: baseMultiplier;
}

export function getRewardItemCount(participantCount: number, category: TournamentCategory): number {
	const level100ItemCount = TournamentConstants.BASE_LEVEL_100_ITEM_REWARD_COUNT
		+ Math.floor(participantCount / TournamentConstants.ADDITIONAL_ITEM_PARTICIPANT_STEP);
	return category === TournamentCategories.LEVEL_50
		? Math.ceil(level100ItemCount / TournamentConstants.LEVEL_50_REWARD_DIVISOR)
		: level100ItemCount;
}

export function getTournamentPhaseEnd(tournament: Tournament): Date {
	return tournament.status === TournamentStatuses.REGISTRATION
		? tournament.registrationEndsAt
		: tournament.combatEndsAt;
}

export function getEndingNotificationDate(tournament: Tournament): Date {
	const combatDuration = tournament.combatEndsAt.getTime() - tournament.registrationEndsAt.getTime();
	const configuredLead = hoursToMilliseconds(asHours(TournamentConstants.ENDING_NOTIFICATION_LEAD_HOURS));
	const lead = combatDuration < configuredLead
		? Math.floor(combatDuration / 2)
		: configuredLead;
	return new Date(tournament.combatEndsAt.getTime() - lead);
}

export function getGameResult(isWinner: boolean, isDraw: boolean): EloGameResult {
	if (isDraw) {
		return 0.5;
	}
	return isWinner ? 1 : 0;
}

export function sortParticipants(participants: TournamentParticipant[], playersById: Map<number, Player>): TournamentParticipant[] {
	return [...participants].sort((left, right) => {
		const gloryDifference = right.getTotalGloryPoints() - left.getTotalGloryPoints();
		if (gloryDifference !== 0) {
			return gloryDifference;
		}
		const leftLevel = getEffectiveLevel(left.category, playersById.get(left.playerId)?.level ?? 0);
		const rightLevel = getEffectiveLevel(right.category, playersById.get(right.playerId)?.level ?? 0);
		return rightLevel - leftLevel || left.playerId - right.playerId;
	});
}
