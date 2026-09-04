import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandTournamentAdminMenuPacketReq, CommandTournamentAdminMenuPacketRes,
	CommandTournamentCancelPacketReq, CommandTournamentCancelPacketRes,
	CommandTournamentContextPacketReq, CommandTournamentContextPacketRes,
	CommandTournamentCreatePacketReq, CommandTournamentCreatePacketRes,
	CommandTournamentErrorPacketRes, CommandTournamentGenerateCodePacketReq,
	CommandTournamentGenerateCodePacketRes, CommandTournamentResumePacketReq,
	CommandTournamentResumePacketRes, CommandTournamentStatusPacketReq,
	CommandTournamentStatusPacketRes, CommandTournamentOwnerMenuPacketReq,
	CommandTournamentOwnerMenuPacketRes, CommandTournamentPausePacketReq, TournamentErrorCodes
} from "../../../../Lib/src/packets/commands/CommandTournamentPacket";
import { TournamentStatuses } from "../../../../Lib/src/types/Tournament";
import type { TournamentStatusData } from "../../core/tournaments/TournamentRules";
import { TournamentConstants } from "../../../../Lib/src/constants/TournamentConstants";
import Player, { Players } from "../../core/database/game/models/Player";
import type Tournament from "../../core/database/game/models/Tournament";
import {
	adminCommand, commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import { TournamentDomainError } from "../../core/tournaments/TournamentErrors";
import {
	findTournamentForContext, getParticipant, getTournamentAdminMenuData, getTournamentOwnerMenuData
} from "../../core/tournaments/TournamentQueries";
import {
	pauseTournamentForChannel, resumeTournament
} from "../../core/tournaments/TournamentPause";
import {
	generateTournamentCode, createTournament
} from "../../core/tournaments/TournamentCreation";
import { registerPlayer } from "../../core/tournaments/TournamentRegistration";
import { getStatusData } from "../../core/tournaments/TournamentRanking";
import { cancelTournament } from "../../core/tournaments/TournamentCancellation";
import { claimTournamentReward } from "../../core/tournaments/TournamentRewards";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";

function pushTournamentError(response: CrowniclesPacket[], error: unknown, reason: string): void {
	if (error instanceof TournamentDomainError) {
		response.push(makePacket(CommandTournamentErrorPacketRes, {
			errorCode: error.code
		}));
		return;
	}
	CrowniclesLogger.errorWithObj(reason, error);
	response.push(makePacket(CommandTournamentErrorPacketRes, {
		errorCode: TournamentErrorCodes.NOT_FOUND
	}));
}

type AutomaticRegistrationResult = {
	newlyRegistered: boolean;
	shouldRefreshStatus: boolean;
};

function canAutomaticallyRegister(
	status: TournamentStatusData,
	contextTournament: Tournament | null
): boolean {
	return !status.category
		&& contextTournament?.id === status.tournamentId
		&& (status.status === TournamentStatuses.REGISTRATION || status.status === TournamentStatuses.COMBAT);
}

async function automaticallyRegisterPlayer(
	context: PacketContext,
	player: Player,
	status: TournamentStatusData,
	contextTournament: Tournament | null
): Promise<AutomaticRegistrationResult> {
	if (!canAutomaticallyRegister(status, contextTournament)) {
		return {
			newlyRegistered: false,
			shouldRefreshStatus: false
		};
	}
	try {
		await registerPlayer(context, player);
		return {
			newlyRegistered: true,
			shouldRefreshStatus: true
		};
	}
	catch (error) {
		if (!(error instanceof TournamentDomainError) || error.code !== TournamentErrorCodes.ALREADY_REGISTERED) {
			throw error;
		}
		return {
			newlyRegistered: false,
			shouldRefreshStatus: true
		};
	}
}

async function getStatusForPlayerCommand(
	context: PacketContext,
	player: Player
): Promise<{
	status: TournamentStatusData;
	newlyRegistered: boolean;
}> {
	const initialStatus = await getStatusData(context, player);
	const contextTournament = await findTournamentForContext(context, false);
	const registration = await automaticallyRegisterPlayer(context, player, initialStatus, contextTournament);
	return {
		status: registration.shouldRefreshStatus ? await getStatusData(context, player) : initialStatus,
		newlyRegistered: registration.newlyRegistered
	};
}

export default class TournamentCommand {
	@adminCommand(CommandTournamentContextPacketReq, (): boolean => true)
	static async context(response: CrowniclesPacket[], _packet: CommandTournamentContextPacketReq, context: PacketContext): Promise<void> {
		const tournament = await findTournamentForContext(context, true);
		const player = context.keycloakId ? await Players.getByKeycloakId(context.keycloakId) : null;
		const participant = tournament && player
			? await getParticipant(tournament.id, player.id)
			: null;
		response.push(makePacket(CommandTournamentContextPacketRes, {
			active: tournament !== null,
			participant: participant !== null,
			status: tournament?.status
		}));
	}

	@adminCommand(CommandTournamentAdminMenuPacketReq, context => context.discord?.isGuildAdministrator === true)
	static async adminMenu(response: CrowniclesPacket[], _packet: CommandTournamentAdminMenuPacketReq, context: PacketContext): Promise<void> {
		try {
			response.push(makePacket(CommandTournamentAdminMenuPacketRes, await getTournamentAdminMenuData(context.frontEndSubOrigin)));
		}
		catch (error) {
			pushTournamentError(response, error, "Tournament admin menu retrieval failed");
		}
	}

	@adminCommand(CommandTournamentOwnerMenuPacketReq, context => context.discord?.isBotOwner === true)
	static async ownerMenu(response: CrowniclesPacket[], _packet: CommandTournamentOwnerMenuPacketReq, context: PacketContext): Promise<void> {
		try {
			response.push(makePacket(CommandTournamentOwnerMenuPacketRes, await getTournamentOwnerMenuData(context.frontEndSubOrigin)));
		}
		catch (error) {
			pushTournamentError(response, error, "Tournament owner menu retrieval failed");
		}
	}

	@adminCommand(CommandTournamentPausePacketReq, (): boolean => true)
	static async pause(_response: CrowniclesPacket[], packet: CommandTournamentPausePacketReq): Promise<void> {
		await pauseTournamentForChannel(packet.discordGuildId, packet.discordChannelId);
	}

	@adminCommand(CommandTournamentGenerateCodePacketReq, context => context.discord?.isBotOwner === true)
	static async generateCode(response: CrowniclesPacket[], _packet: CommandTournamentGenerateCodePacketReq, context: PacketContext): Promise<void> {
		try {
			const result = await generateTournamentCode(context.frontEndSubOrigin);
			response.push(makePacket(CommandTournamentGenerateCodePacketRes, {
				code: result.code,
				expiresAt: result.expiresAt.getTime()
			}));
		}
		catch (error) {
			pushTournamentError(response, error, "Tournament code generation failed");
		}
	}

	@adminCommand(CommandTournamentCreatePacketReq, context => context.discord?.isGuildAdministrator === true)
	static async create(response: CrowniclesPacket[], packet: CommandTournamentCreatePacketReq, context: PacketContext): Promise<void> {
		try {
			const tournament = await createTournament({
				context,
				code: packet.code,
				duration: {
					registrationDays: packet.registrationDays,
					combatDays: packet.combatDays
				},
				...packet.levelLimitMode ? { levelLimitMode: packet.levelLimitMode } : {},
				...packet.levelCap !== undefined ? { levelCap: packet.levelCap } : {}
			});
			response.push(makePacket(CommandTournamentCreatePacketRes, {
				tournamentId: tournament.id,
				registrationEndsAt: tournament.registrationEndsAt.getTime(),
				combatEndsAt: tournament.combatEndsAt.getTime(),
				channelId: tournament.discordChannelId,
				levelLimitMode: tournament.levelLimitMode,
				levelCap: tournament.levelCap
			}));
		}
		catch (error) {
			pushTournamentError(response, error, "Tournament creation failed");
		}
	}

	@commandRequires(CommandTournamentStatusPacketReq, {
		notBlocked: true,
		level: TournamentConstants.MINIMUM_PLAYER_LEVEL,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD,
		tournamentAccess: "status"
	})
	static async status(response: CrowniclesPacket[], player: Player, _packet: CommandTournamentStatusPacketReq, context: PacketContext): Promise<void> {
		try {
			await claimTournamentReward(context, response, player);
			const statusData = await getStatusForPlayerCommand(context, player);
			response.push(makePacket(CommandTournamentStatusPacketRes, {
				...statusData.status,
				newlyRegistered: statusData.newlyRegistered
			}));
		}
		catch (error) {
			pushTournamentError(response, error, "Tournament status retrieval failed");
		}
	}

	@adminCommand(CommandTournamentResumePacketReq, context => context.discord?.isBotOwner === true)
	static async resume(response: CrowniclesPacket[], packet: CommandTournamentResumePacketReq, context: PacketContext): Promise<void> {
		try {
			const tournament = await resumeTournament(packet.tournamentId, context);
			response.push(makePacket(CommandTournamentResumePacketRes, {
				tournamentId: tournament.id,
				channelId: tournament.discordChannelId
			}));
		}
		catch (error) {
			pushTournamentError(response, error, "Tournament resume failed");
		}
	}

	@adminCommand(CommandTournamentCancelPacketReq, context => context.discord?.isGuildAdministrator === true)
	static async cancel(response: CrowniclesPacket[], packet: CommandTournamentCancelPacketReq, context: PacketContext): Promise<void> {
		try {
			await cancelTournament({
				tournamentId: packet.tournamentId,
				discordGuildId: context.frontEndSubOrigin,
				reason: "manual",
				isGuildAdministrator: context.discord?.isGuildAdministrator === true
			});
			response.push(makePacket(CommandTournamentCancelPacketRes, {
				tournamentId: packet.tournamentId
			}));
		}
		catch (error) {
			pushTournamentError(response, error, "Tournament cancellation failed");
		}
	}
}
