import {
	TournamentNotificationEvents, TournamentStatuses
} from "../../../../Lib/src/types/Tournament";
import { TournamentErrorCodes } from "../../../../Lib/src/packets/commands/CommandTournamentPacket";
import { claimTournamentEvent } from "./TournamentNotifications";
import { Tournament } from "../database/game/models/Tournament";
import { TournamentDomainError } from "./TournamentErrors";

export type TournamentCancellationRequest = {
	tournamentId: number;
	discordGuildId: string;
	reason: string;
	isGuildAdministrator: boolean;
};

export async function cancelTournament(request: TournamentCancellationRequest): Promise<void> {
	if (!request.isGuildAdministrator) {
		throw new TournamentDomainError(TournamentErrorCodes.ACCESS_DENIED);
	}
	let shouldNotify = false;
	await Tournament.withLocked(request.tournamentId, async tournament => {
		if (tournament.status === TournamentStatuses.COMPLETED || tournament.status === TournamentStatuses.CANCELLED) {
			return;
		}
		if (tournament.discordGuildId !== request.discordGuildId) {
			throw new TournamentDomainError(TournamentErrorCodes.CODE_GUILD_MISMATCH);
		}
		tournament.status = TournamentStatuses.CANCELLED;
		tournament.rewardsDistributed = true;
		tournament.cancellationReason = request.reason;
		await tournament.save();
		shouldNotify = true;
	});
	if (shouldNotify) {
		await claimTournamentEvent(request.tournamentId, {
			event: TournamentNotificationEvents.ENDED,
			cancellationReason: request.reason
		});
	}
}
