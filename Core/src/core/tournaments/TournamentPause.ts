import { Op } from "sequelize";
import { TournamentStatuses } from "../../../../Lib/src/types/Tournament";
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
	const channelId = context.discord?.channel;
	if (!channelId || !context.frontEndSubOrigin) {
		throw new TournamentDomainError(TournamentErrorCodes.INVALID_CHANNEL);
	}
	if (context.discord?.isBotOwner !== true) {
		throw new TournamentDomainError(TournamentErrorCodes.ACCESS_DENIED);
	}
	return await Tournament.withLocked(tournamentId, async tournament => {
		if (tournament.status !== TournamentStatuses.PAUSED || !tournament.pausedFromStatus) {
			throw new TournamentDomainError(TournamentErrorCodes.INVALID_PHASE);
		}
		if (tournament.discordGuildId !== context.frontEndSubOrigin) {
			throw new TournamentDomainError(TournamentErrorCodes.CODE_GUILD_MISMATCH);
		}
		const remainingMs = tournament.pausedRemainingMs ?? 0;
		const previousStatus = tournament.pausedFromStatus;
		if (previousStatus !== TournamentStatuses.REGISTRATION && previousStatus !== TournamentStatuses.COMBAT) {
			throw new TournamentDomainError(TournamentErrorCodes.INVALID_PHASE);
		}
		updateResumedPhaseDates(tournament, previousStatus, remainingMs);
		tournament.discordGuildId = context.frontEndSubOrigin;
		tournament.discordChannelId = channelId;
		tournament.status = previousStatus;
		tournament.pausedFromStatus = null;
		tournament.pausedRemainingMs = null;
		await tournament.save();
		return tournament;
	});
}
