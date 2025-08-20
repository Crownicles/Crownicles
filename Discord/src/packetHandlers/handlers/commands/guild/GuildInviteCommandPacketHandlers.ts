import { packetHandler } from "../../../PacketHandler";
import {
	CommandGuildInviteAcceptPacketRes,
	CommandGuildInviteAlreadyInAGuild,
	CommandGuildInviteGuildIsFull,
	CommandGuildInviteInvitedPlayerIsDead,
	CommandGuildInviteInvitedPlayerIsOnPveIsland,
	CommandGuildInviteInvitingPlayerNotInGuild,
	CommandGuildInviteLevelTooLow,
	CommandGuildInvitePlayerNotFound,
	CommandGuildInviteRefusePacketRes
} from "../../../../../../Lib/src/packets/commands/CommandGuildInvitePacket";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import {
	handleCommandGuildInviteAcceptPacketRes,
	handleCommandGuildInviteError,
	handleCommandGuildInviteRefusePacketRes
} from "../../../../commands/guild/GuildInviteCommand";
import { handleClassicError } from "../../../../utils/ErrorUtils";

export default class GuildInviteCommandPacketHandlers {
	@packetHandler(CommandGuildInviteInvitedPlayerIsDead)
	async guildInviteInvitedPlayerIsDead(context: PacketContext, packet: CommandGuildInviteInvitedPlayerIsDead): Promise<void> {
		await handleCommandGuildInviteError(packet, context, "error:effects.dead.other");
	}

	@packetHandler(CommandGuildInviteInvitingPlayerNotInGuild)
	async guildInviteInvitingPlayerNotInGuild(context: PacketContext, packet: CommandGuildInviteInvitingPlayerNotInGuild): Promise<void> {
		await handleCommandGuildInviteError(packet, context, "error:notInAGuild");
	}

	@packetHandler(CommandGuildInviteLevelTooLow)
	async guildInviteLevelTooLow(context: PacketContext, packet: CommandGuildInviteLevelTooLow): Promise<void> {
		await handleCommandGuildInviteError(packet, context, "error:targetLevelTooLow");
	}

	@packetHandler(CommandGuildInviteGuildIsFull)
	async guildInviteGuildIsFull(context: PacketContext, packet: CommandGuildInviteGuildIsFull): Promise<void> {
		await handleCommandGuildInviteError(packet, context, "commands:guildInvite.errors.guildIsFull");
	}

	@packetHandler(CommandGuildInviteInvitedPlayerIsOnPveIsland)
	async guildInviteInvitedPlayerIsOnPveIsland(context: PacketContext, packet: CommandGuildInviteInvitedPlayerIsOnPveIsland): Promise<void> {
		await handleCommandGuildInviteError(packet, context, "commands:guildInvite.errors.playerIsOnPveIsland");
	}

	@packetHandler(CommandGuildInviteAlreadyInAGuild)
	async guildInviteAlreadyInAGuild(context: PacketContext, packet: CommandGuildInviteAlreadyInAGuild): Promise<void> {
		await handleCommandGuildInviteError(packet, context, "commands:guildInvite.errors.playerIsAlreadyInAGuild");
	}

	@packetHandler(CommandGuildInviteRefusePacketRes)
	async guildInviteRefuseRes(context: PacketContext, packet: CommandGuildInviteRefusePacketRes): Promise<void> {
		await handleCommandGuildInviteRefusePacketRes(packet, context);
	}

	@packetHandler(CommandGuildInviteAcceptPacketRes)
	async guildInviteAcceptRes(context: PacketContext, packet: CommandGuildInviteAcceptPacketRes): Promise<void> {
		await handleCommandGuildInviteAcceptPacketRes(packet, context);
	}

	@packetHandler(CommandGuildInvitePlayerNotFound)
	async guildInvitePlayerNotFound(context: PacketContext, _packet: CommandGuildInvitePlayerNotFound): Promise<void> {
		await handleClassicError(context, "error:playerDoesntExist", {}, { ephemeral: true });
	}
}
