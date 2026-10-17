import {
	CommandTournamentContextPacketReq, CommandTournamentContextPacketRes, TournamentErrorCodes
} from "../../../../Lib/src/packets/commands/CommandTournamentPacket";
import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { TournamentConstants } from "../../../../Lib/src/constants/TournamentConstants";
import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import { DiscordMQTT } from "../../bot/DiscordMQTT";
import { replyTournamentError } from "./TournamentCommandUtils";

// Participant checks are enforced by the Core: the front only filters the commands that make sense in a tournament channel
const TOURNAMENT_CHANNEL_COMMAND_NAMES = new Set([
	"tournament",
	"tournament-admin",
	"tournament-owner",
	"fight",
	"top",

	// Debug commands must stay usable in a tournament channel, otherwise test fixtures can no longer be cleaned up
	"test"
]);

type TournamentChannelCacheEntry = {
	active: boolean;
	expiresAt: number;
};

const tournamentChannelCache = new Map<string, TournamentChannelCacheEntry>();

export function isAllowedInTournament(commandName: string): boolean {
	return TOURNAMENT_CHANNEL_COMMAND_NAMES.has(commandName);
}

export function clearTournamentChannelCache(): void {
	tournamentChannelCache.clear();
}

function queryTournamentChannel(context: PacketContext): Promise<boolean | null> {
	return new Promise(resolve => {
		DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse(
			context,
			makePacket(CommandTournamentContextPacketReq, {}),
			(_responseContext, _packetName, responsePacket) => {
				resolve((responsePacket as CommandTournamentContextPacketRes).active);
				return Promise.resolve();
			},
			{
				timeoutMs: TournamentConstants.CONTEXT_QUERY_TIMEOUT_MS,
				onTimeout: (): void => resolve(null)
			}
		).catch(() => resolve(null));
	});
}

async function isTournamentChannel(interaction: CrowniclesInteraction, context: PacketContext): Promise<boolean> {
	const cached = tournamentChannelCache.get(interaction.channelId);
	if (cached && cached.expiresAt > Date.now()) {
		return cached.active;
	}
	const active = await queryTournamentChannel(context);
	if (active === null) {
		// The Core still rejects the commands it handles, so failing open only matters for front-only commands
		return false;
	}
	tournamentChannelCache.set(interaction.channelId, {
		active,
		expiresAt: Date.now() + TournamentConstants.CONTEXT_CACHE_TTL_MS
	});
	return active;
}

export async function checkTournamentCommandAccess(
	interaction: CrowniclesInteraction,
	context: PacketContext
): Promise<boolean> {
	if (!interaction.guild || isAllowedInTournament(interaction.commandName)) {
		return true;
	}
	if (!await isTournamentChannel(interaction, context)) {
		return true;
	}
	await replyTournamentError(interaction, TournamentErrorCodes.ACCESS_DENIED);
	return false;
}
