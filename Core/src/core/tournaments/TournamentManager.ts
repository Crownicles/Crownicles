import {
	CrowniclesPacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	TournamentErrorCodes
} from "../../../../Lib/src/packets/commands/CommandTournamentPacket";
import {
	TournamentNotificationEvents,
	TournamentStatuses
} from "../../../../Lib/src/types/Tournament";
import { Tournament } from "../database/game/models/Tournament";
import { TournamentParticipant } from "../database/game/models/TournamentParticipant";
import Player from "../database/game/models/Player";
import type { FightController } from "../fights/FightController";
import {
	TournamentDomainError
} from "./TournamentErrors";
import type {
	TournamentCommandAccess
} from "./TournamentTypes";
import {
	TournamentStatusData, TournamentTopData
} from "./TournamentRules";
import {
	sendTournamentEvent
} from "./TournamentNotifications";
import {
	findAndReserveOpponent, findOpponent, reserveDefender
} from "./TournamentMatchmaking";
import { processDueTournaments as processTournamentDeadlines } from "./TournamentLifecycle";
import { resolveTournamentFight } from "./TournamentFightResolver";
import {
	createTournament, generateTournamentCode, TournamentCodeGenerationResult
} from "./TournamentCreation";
import {
	findTournamentForContext as findTournamentInContext,
	getParticipant as getTournamentParticipant
} from "./TournamentQueries";
import { registerPlayer as registerTournamentPlayer } from "./TournamentRegistration";
import { verifyCommandAccess as verifyTournamentCommandAccess } from "./TournamentAccess";
import {
	pauseTournament, pauseTournamentForChannel, resumeTournament
} from "./TournamentPause";
import {
	getStatusData as getTournamentStatusData,
	getTopData as getTournamentTopData
} from "./TournamentRanking";

export {
	TournamentDomainError
} from "./TournamentErrors";
export type {
	TournamentCommandAccess, TournamentFightContext
} from "./TournamentTypes";

export abstract class TournamentManager {
	public static async generateCode(discordGuildId: string): Promise<TournamentCodeGenerationResult> {
		return await generateTournamentCode(discordGuildId);
	}

	public static async createTournament(context: PacketContext, code: string, registrationDays: number, combatDays: number): Promise<Tournament> {
		return await createTournament(context, code, registrationDays, combatDays);
	}

	public static async registerPlayer(context: PacketContext, player: Player): Promise<TournamentParticipant> {
		return await registerTournamentPlayer(context, player);
	}

	public static async getTournamentForContext(context: PacketContext): Promise<Tournament | null> {
		return await findTournamentInContext(context, false);
	}

	public static async findTournamentForContext(context: PacketContext, includeFinished: boolean): Promise<Tournament | null> {
		return await findTournamentInContext(context, includeFinished);
	}

	public static async getParticipant(tournamentId: number, playerId: number): Promise<TournamentParticipant | null> {
		return await getTournamentParticipant(tournamentId, playerId);
	}

	public static async findOpponent(tournament: Tournament, participant: TournamentParticipant): Promise<TournamentParticipant | null> {
		return await findOpponent(tournament, participant);
	}

	public static async findAndReserveOpponent(tournament: Tournament, participant: TournamentParticipant): Promise<TournamentParticipant | null> {
		return await findAndReserveOpponent(tournament, participant);
	}

	public static reserveDefender(tournamentId: number, participantId: number): void {
		reserveDefender(tournamentId, participantId);
	}

	public static async verifyCommandAccess(player: Player, context: PacketContext, response: CrowniclesPacket[], access: TournamentCommandAccess): Promise<boolean> {
		return await verifyTournamentCommandAccess(player, context, response, access);
	}

	public static async getStatusData(context: PacketContext, player: Player): Promise<TournamentStatusData> {
		return await getTournamentStatusData(context, player);
	}

	public static async getTopData(context: PacketContext, player: Player, requestedPage?: number): Promise<TournamentTopData> {
		return await getTournamentTopData(context, player, requestedPage);
	}

	public static async pauseTournament(tournamentId: number): Promise<void> {
		await pauseTournament(tournamentId);
	}

	public static async pauseTournamentForChannel(discordGuildId: string, discordChannelId: string): Promise<void> {
		await pauseTournamentForChannel(discordGuildId, discordChannelId);
	}

	public static async resumeTournament(tournamentId: number, context: PacketContext): Promise<Tournament> {
		return await resumeTournament(tournamentId, context);
	}

	public static async cancelTournament(tournamentId: number, discordGuildId: string, reason: string, isGuildAdministrator: boolean): Promise<void> {
		if (!isGuildAdministrator) {
			throw new TournamentDomainError(TournamentErrorCodes.ACCESS_DENIED);
		}
		let participants: TournamentParticipant[] = [];
		await Tournament.withLocked(tournamentId, async tournament => {
			if (tournament.status === TournamentStatuses.COMPLETED || tournament.status === TournamentStatuses.CANCELLED) {
				return;
			}
			if (tournament.discordGuildId !== discordGuildId) {
				throw new TournamentDomainError(TournamentErrorCodes.CODE_GUILD_MISMATCH);
			}
			participants = await TournamentParticipant.findAll({ where: { tournamentId } });
			tournament.status = TournamentStatuses.CANCELLED;
			tournament.rewardsDistributed = true;
			tournament.endedNotificationSent = true;
			await tournament.save();
		});
		if (participants.length > 0) {
			sendTournamentEvent(tournamentId, participants, {
				event: TournamentNotificationEvents.ENDED,
				cancellationReason: reason
			});
		}
	}

	public static async processDueTournaments(): Promise<void> {
		await processTournamentDeadlines();
	}

	public static async resolveFight(fight: FightController, response: CrowniclesPacket[]): Promise<void> {
		await resolveTournamentFight(fight, response);
	}
}
