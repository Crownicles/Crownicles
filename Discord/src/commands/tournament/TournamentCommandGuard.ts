import {
	CommandTournamentContextPacketReq, CommandTournamentContextPacketRes
} from "../../../../Lib/src/packets/commands/CommandTournamentPacket";
import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { TournamentConstants } from "../../../../Lib/src/constants/TournamentConstants";
import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import { DiscordMQTT } from "../../bot/DiscordMQTT";
import {
	isBotOwner, replyTournamentError
} from "./TournamentCommandUtils";

const TOURNAMENT_COMMAND_NAMES = new Set([
	"tournament-code",
	"tournament-create",
	"tournament-register",
	"tournament-status",
	"tournament-resume",
	"tournament-cancel",
	"fight",
	"top"
]);

function isAllowedInTournament(commandName: string, participant: boolean, owner: boolean): boolean {
	if (commandName === "tournament-register" || commandName.startsWith("tournament-")) {
		if (commandName === "tournament-status") {
			return participant;
		}
		if (commandName === "tournament-resume") {
			return owner;
		}
		return true;
	}
	return participant && TOURNAMENT_COMMAND_NAMES.has(commandName);
}

export async function checkTournamentCommandAccess(
	interaction: CrowniclesInteraction,
	context: PacketContext
): Promise<boolean> {
	return await new Promise(resolve => {
		let settled = false;
		const finish = (allowed: boolean): void => {
			if (!settled) {
				settled = true;
				resolve(allowed);
			}
		};
		DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse(
			context,
			makePacket(CommandTournamentContextPacketReq, {}),
			async (_responseContext, _packetName, responsePacket) => {
				const packet = responsePacket as CommandTournamentContextPacketRes;
				if (!packet.active || isAllowedInTournament(interaction.commandName, packet.participant, isBotOwner(interaction))) {
					finish(true);
					return;
				}
				await replyTournamentError(interaction, "accessDenied");
				finish(false);
			},
			{
				timeoutMs: TournamentConstants.CONTEXT_QUERY_TIMEOUT_MS,
				onTimeout: (): void => finish(true)
			}
		);
	});
}
