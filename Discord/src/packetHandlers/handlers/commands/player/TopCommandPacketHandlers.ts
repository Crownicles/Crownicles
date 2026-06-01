import { packetHandler } from "../../../PacketHandler";
import {
	CommandTopGuildsEmptyPacket,
	CommandTopPacketResGlory, CommandTopPacketResGuild,
	CommandTopPacketResScore, CommandTopPlayersEmptyPacket
} from "../../../../../../Lib/src/packets/commands/CommandTopPacket";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import {
	handleCommandTopGuildsEmptyPacket,
	handleCommandTopPacketResGlory,
	handleCommandTopPacketResGuild,
	handleCommandTopPacketResScore, handleCommandTopPlayersEmptyPacket
} from "../../../../commands/player/TopCommand";

export default class TopCommandPacketHandlers {
	@packetHandler(CommandTopPacketResScore)
	async topScoreRes(context: PacketContext, packet: CommandTopPacketResScore): Promise<void> {
		await handleCommandTopPacketResScore(context, packet);
	}

	@packetHandler(CommandTopPacketResGlory)
	async topGloryRes(context: PacketContext, packet: CommandTopPacketResGlory): Promise<void> {
		await handleCommandTopPacketResGlory(context, packet);
	}

	@packetHandler(CommandTopPacketResGuild)
	async topGuildRes(context: PacketContext, packet: CommandTopPacketResGuild): Promise<void> {
		await handleCommandTopPacketResGuild(context, packet);
	}

	@packetHandler(CommandTopPlayersEmptyPacket)
	async topPlayersEmptyRes(context: PacketContext, packet: CommandTopPlayersEmptyPacket): Promise<void> {
		await handleCommandTopPlayersEmptyPacket(context, packet);
	}

	@packetHandler(CommandTopGuildsEmptyPacket)
	async topGuildsEmptyRes(context: PacketContext, _packet: CommandTopGuildsEmptyPacket): Promise<void> {
		await handleCommandTopGuildsEmptyPacket(context);
	}
}
