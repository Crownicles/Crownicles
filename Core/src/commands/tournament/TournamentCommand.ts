import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandTournamentCancelPacketReq, CommandTournamentCancelPacketRes,
	CommandTournamentContextPacketReq, CommandTournamentContextPacketRes,
	CommandTournamentCreatePacketReq, CommandTournamentCreatePacketRes,
	CommandTournamentErrorPacketRes, CommandTournamentGenerateCodePacketReq,
	CommandTournamentGenerateCodePacketRes, CommandTournamentRegisterPacketReq,
	CommandTournamentRegisterPacketRes, CommandTournamentResumePacketReq,
	CommandTournamentResumePacketRes, CommandTournamentStatusPacketReq,
	CommandTournamentStatusPacketRes, CommandTournamentPausePacketReq, TournamentErrorCodes
} from "../../../../Lib/src/packets/commands/CommandTournamentPacket";
import Player, { Players } from "../../core/database/game/models/Player";
import {
	adminCommand, commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import { TournamentDomainError } from "../../core/tournaments/TournamentErrors";
import {
	findTournamentForContext, getParticipant
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
import { TournamentConstants } from "../../../../Lib/src/constants/TournamentConstants";
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
				}
			});
			response.push(makePacket(CommandTournamentCreatePacketRes, {
				tournamentId: tournament.id,
				registrationEndsAt: tournament.registrationEndsAt.getTime(),
				combatEndsAt: tournament.combatEndsAt.getTime(),
				channelId: tournament.discordChannelId
			}));
		}
		catch (error) {
			pushTournamentError(response, error, "Tournament creation failed");
		}
	}

	@commandRequires(CommandTournamentRegisterPacketReq, {
		notBlocked: true,
		level: TournamentConstants.MINIMUM_PLAYER_LEVEL,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD,
		tournamentAccess: "registration"
	})
	static async register(response: CrowniclesPacket[], player: Player, _packet: CommandTournamentRegisterPacketReq, context: PacketContext): Promise<void> {
		try {
			const participant = await registerPlayer(context, player);
			response.push(makePacket(CommandTournamentRegisterPacketRes, {
				tournamentId: participant.tournamentId,
				category: participant.category,
				attackGloryPoints: participant.attackGloryPoints,
				defenseGloryPoints: participant.defenseGloryPoints,
				lateRegistration: participant.lateRegistration
			}));
		}
		catch (error) {
			pushTournamentError(response, error, "Tournament registration failed");
		}
	}

	@commandRequires(CommandTournamentStatusPacketReq, {
		notBlocked: false,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE,
		tournamentAccess: "status"
	})
	static async status(response: CrowniclesPacket[], player: Player, _packet: CommandTournamentStatusPacketReq, context: PacketContext): Promise<void> {
		try {
			await claimTournamentReward(context, response, player);
			response.push(makePacket(CommandTournamentStatusPacketRes, await getStatusData(context, player)));
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
