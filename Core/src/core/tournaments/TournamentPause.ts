import { Op } from "sequelize";
import {
	TournamentStatuses
} from "../../../../Lib/src/types/Tournament";
import { TournamentErrorCodes } from "../../../../Lib/src/packets/commands/CommandTournamentPacket";
import { PacketContext } from "../../../../Lib/src/packets/CrowniclesPacket";
import { getTournamentPhaseEnd } from "./TournamentRules";
import { Tournament } from "../database/game/models/Tournament";
import { TournamentDomainError } from "./TournamentErrors";

function updateResumedPhaseDates(
	tournament: Tournament,
	previousStatus: typeof TournamentStatuses.REGISTRATION | typeof TournamentStatuses.COMBAT,
	remainingMs: number
): void {
	if (previousStatus === TournamentStatuses.REGISTRATION) {
		const combatDuration = tournament.combatEndsAt.getTime() - tournament.registrationEndsAt.getTime();
		tournament.registrationEndsAt = new Date(Date.now() + remainingMs);
		tournament.combatEndsAt = new Date(tournament.registrationEndsAt.getTime() + combatDuration);
		return;
	}
	tournament.combatEndsAt = new Date(Date.now() + remainingMs);
}

type ResumableTournamentStatus = typeof TournamentStatuses.REGISTRATION | typeof TournamentStatuses.COMBAT;

type ResumeData = {
	channelId: string;
	previousStatus: ResumableTournamentStatus;
	remainingMs: number;
};

type ResumeChannel = {
	channelId: string;
	guildId: string;
};

function getResumeChannel(context: PacketContext): ResumeChannel {
	const channelId = context.discord?.channel;
	if (!channelId || !context.frontEndSubOrigin) {
		throw new TournamentDomainError(TournamentErrorCodes.INVALID_CHANNEL);
	}
	return {
		channelId,
		guildId: context.frontEndSubOrigin
	};
}

function requireBotOwner(context: PacketContext): void {
	if (context.discord?.isBotOwner !== true) {
		throw new TournamentDomainError(TournamentErrorCodes.ACCESS_DENIED);
	}
}

function getPausedStatus(tournament: Tournament): ResumableTournamentStatus {
	if (tournament.status !== TournamentStatuses.PAUSED || !tournament.pausedFromStatus) {
		throw new TournamentDomainError(TournamentErrorCodes.INVALID_PHASE);
	}
	if (tournament.pausedFromStatus !== TournamentStatuses.REGISTRATION
		&& tournament.pausedFromStatus !== TournamentStatuses.COMBAT) {
		throw new TournamentDomainError(TournamentErrorCodes.INVALID_PHASE);
	}
	return tournament.pausedFromStatus;
}

function requireSameGuild(tournament: Tournament, guildId: string): void {
	if (tournament.discordGuildId !== guildId) {
		throw new TournamentDomainError(TournamentErrorCodes.CODE_GUILD_MISMATCH);
	}
}

function getResumeData(tournament: Tournament, context: PacketContext): ResumeData {
	const {
		channelId,
		guildId
	} = getResumeChannel(context);
	requireBotOwner(context);
	const previousStatus = getPausedStatus(tournament);
	requireSameGuild(tournament, guildId);
	return {
		channelId,
		previousStatus,
		remainingMs: tournament.pausedRemainingMs ?? 0
	};
}

function applyResume(tournament: Tournament, context: PacketContext, resumeData: ResumeData): void {
	updateResumedPhaseDates(tournament, resumeData.previousStatus, resumeData.remainingMs);
	tournament.discordGuildId = context.frontEndSubOrigin;
	tournament.discordChannelId = resumeData.channelId;
	tournament.status = resumeData.previousStatus;
	tournament.pausedFromStatus = null;
	tournament.pausedRemainingMs = null;
}

export async function pauseTournament(tournamentId: number): Promise<void> {
	await Tournament.withLocked(tournamentId, async tournament => {
		if (tournament.status !== TournamentStatuses.REGISTRATION && tournament.status !== TournamentStatuses.COMBAT) {
			return;
		}
		const remainingMs = Math.max(0, getTournamentPhaseEnd(tournament).getTime() - Date.now());
		tournament.pausedFromStatus = tournament.status;
		tournament.pausedRemainingMs = remainingMs;
		tournament.status = TournamentStatuses.PAUSED;
		await tournament.save();
	});
}

export async function pauseTournamentForChannel(discordGuildId: string, discordChannelId: string): Promise<void> {
	const tournament = await Tournament.findOne({
		where: {
			discordGuildId,
			discordChannelId,
			status: { [Op.in]: [TournamentStatuses.REGISTRATION, TournamentStatuses.COMBAT] }
		}
	});
	if (tournament) {
		await pauseTournament(tournament.id);
	}
}

export async function resumeTournament(tournamentId: number, context: PacketContext): Promise<Tournament> {
	return await Tournament.withLocked(tournamentId, async tournament => {
		applyResume(tournament, context, getResumeData(tournament, context));
		await tournament.save();
		return tournament;
	});
}
