import {
	TournamentNotificationEvents, TournamentStatuses
} from "../../../../Lib/src/types/Tournament";
import { TournamentErrorCodes } from "../../../../Lib/src/packets/commands/CommandTournamentPacket";
import { sendTournamentEvent } from "./TournamentNotifications";
import { Tournament } from "../database/game/models/Tournament";
import { TournamentParticipant } from "../database/game/models/TournamentParticipant";
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
	let participants: TournamentParticipant[] = [];
	await Tournament.withLocked(request.tournamentId, async tournament => {
		if (tournament.status === TournamentStatuses.COMPLETED || tournament.status === TournamentStatuses.CANCELLED) {
			return;
		}
		if (tournament.discordGuildId !== request.discordGuildId) {
			throw new TournamentDomainError(TournamentErrorCodes.CODE_GUILD_MISMATCH);
		}
		participants = await TournamentParticipant.findAll({ where: { tournamentId: request.tournamentId } });
		tournament.status = TournamentStatuses.CANCELLED;
		tournament.rewardsDistributed = true;
		tournament.endedNotificationSent = true;
		await tournament.save();
	});
	if (participants.length > 0) {
		sendTournamentEvent(request.tournamentId, participants, {
			event: TournamentNotificationEvents.ENDED,
			cancellationReason: request.reason
		});
	}
}
