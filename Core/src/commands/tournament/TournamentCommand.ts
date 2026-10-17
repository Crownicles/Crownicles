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
	CommandTournamentOwnerMenuPacketRes, CommandTournamentPausePacketReq, CommandTournamentRegisterPacketReq,
	CommandTournamentUnregisterPacketReq, TournamentErrorCodes
} from "../../../../Lib/src/packets/commands/CommandTournamentPacket";
import {
	TournamentCancellationReasons, TournamentRegistrationChange, TournamentRegistrationChanges, TournamentStatuses
} from "../../../../Lib/src/types/Tournament";
import type { TournamentStatusData } from "../../core/tournaments/TournamentRules";
import { TournamentConstants } from "../../../../Lib/src/constants/TournamentConstants";
import Player from "../../core/database/game/models/Player";
import type Tournament from "../../core/database/game/models/Tournament";
import {
	adminCommand, CommandRequirements, commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import { TournamentDomainError } from "../../core/tournaments/TournamentErrors";
import {
	findTournamentForContext, getTournamentAdminMenuData, getTournamentOwnerMenuData
} from "../../core/tournaments/TournamentQueries";
import {
	pauseTournamentForChannel, resumeTournament
} from "../../core/tournaments/TournamentPause";
import {
	generateTournamentCode, createTournament
} from "../../core/tournaments/TournamentCreation";
import {
	registerPlayer, unregisterPlayer
} from "../../core/tournaments/TournamentRegistration";
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
		errorCode: TournamentErrorCodes.UNEXPECTED
	}));
}

type TournamentRegistrationActions = Pick<CommandTournamentStatusPacketRes, "canRegister" | "canUnregister">;

function getRegistrationActions(
	status: TournamentStatusData,
	contextTournament: Tournament | null
): TournamentRegistrationActions {
	const inTournamentChannel = contextTournament?.id === status.tournamentId;
	return {
		canRegister: inTournamentChannel
			&& !status.category
			&& (status.status === TournamentStatuses.REGISTRATION || status.status === TournamentStatuses.COMBAT),
		canUnregister: inTournamentChannel
			&& Boolean(status.category)
			&& status.status === TournamentStatuses.REGISTRATION
	};
}

async function pushStatus(
	response: CrowniclesPacket[],
	context: PacketContext,
	player: Player,
	registrationChange?: TournamentRegistrationChange
): Promise<void> {
	const status = await getStatusData(context, player);
	const contextTournament = await findTournamentForContext(context, false);
	response.push(makePacket(CommandTournamentStatusPacketRes, {
		...status,
		...getRegistrationActions(status, contextTournament),
		...registrationChange ? { registrationChange } : {}
	}));
}

const PLAYER_TOURNAMENT_REQUIREMENTS: CommandRequirements = {
	notBlocked: true,
	level: TournamentConstants.MINIMUM_PLAYER_LEVEL,
	whereAllowed: CommandUtils.WHERE.EVERYWHERE,
	disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD,
	tournamentAccess: "status"
};

export default class TournamentCommand {
	@adminCommand(CommandTournamentContextPacketReq, (): boolean => true)
	static async context(response: CrowniclesPacket[], _packet: CommandTournamentContextPacketReq, context: PacketContext): Promise<void> {
		response.push(makePacket(CommandTournamentContextPacketRes, {
			active: await findTournamentForContext(context, false) !== null
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

	@commandRequires(CommandTournamentStatusPacketReq, PLAYER_TOURNAMENT_REQUIREMENTS)
	static async status(response: CrowniclesPacket[], player: Player, _packet: CommandTournamentStatusPacketReq, context: PacketContext): Promise<void> {
		try {
			await claimTournamentReward(response, player);
			await pushStatus(response, context, player);
		}
		catch (error) {
			pushTournamentError(response, error, "Tournament status retrieval failed");
		}
	}

	@commandRequires(CommandTournamentRegisterPacketReq, PLAYER_TOURNAMENT_REQUIREMENTS)
	static async register(response: CrowniclesPacket[], player: Player, _packet: CommandTournamentRegisterPacketReq, context: PacketContext): Promise<void> {
		try {
			await registerPlayer(context, player);
			await pushStatus(response, context, player, TournamentRegistrationChanges.REGISTERED);
		}
		catch (error) {
			pushTournamentError(response, error, "Tournament registration failed");
		}
	}

	@commandRequires(CommandTournamentUnregisterPacketReq, PLAYER_TOURNAMENT_REQUIREMENTS)
	static async unregister(response: CrowniclesPacket[], player: Player, _packet: CommandTournamentUnregisterPacketReq, context: PacketContext): Promise<void> {
		try {
			await unregisterPlayer(context, player);
			await pushStatus(response, context, player, TournamentRegistrationChanges.UNREGISTERED);
		}
		catch (error) {
			pushTournamentError(response, error, "Tournament unregistration failed");
		}
	}

	@adminCommand(CommandTournamentResumePacketReq, context => context.discord?.isBotOwner === true || context.discord?.isGuildAdministrator === true)
	static async resume(response: CrowniclesPacket[], packet: CommandTournamentResumePacketReq, context: PacketContext): Promise<void> {
		try {
			const tournament = await resumeTournament(packet.tournamentId, context);
			response.push(makePacket(CommandTournamentResumePacketRes, {
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
				reason: TournamentCancellationReasons.MANUAL,
				isGuildAdministrator: context.discord?.isGuildAdministrator === true
			});
			response.push(makePacket(CommandTournamentCancelPacketRes, {}));
		}
		catch (error) {
			pushTournamentError(response, error, "Tournament cancellation failed");
		}
	}
}
