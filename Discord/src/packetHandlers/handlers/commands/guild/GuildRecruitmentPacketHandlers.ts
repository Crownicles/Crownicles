import { packetHandler } from "../../../PacketHandler";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandGuildJoinErrorPacket,
	CommandGuildJoinPacketRes,
	CommandGuildRecruitmentErrorPacket,
	CommandGuildRecruitmentListPacketRes,
	CommandGuildRecruitmentPacketRes
} from "../../../../../../Lib/src/packets/commands/CommandGuildRecruitmentPacket";
import { handleClassicError } from "../../../../utils/ErrorUtils";
import { handleCommandGuildRecruitmentPacketRes } from "../../../../commands/guild/GuildRecruitmentCommand";
import {
	handleCommandGuildJoinPacketRes, handleCommandGuildRecruitmentListPacketRes
} from "../../../../commands/guild/GuildJoinCommand";

export default class GuildRecruitmentPacketHandlers {
	@packetHandler(CommandGuildRecruitmentPacketRes)
	async guildRecruitmentRes(context: PacketContext, packet: CommandGuildRecruitmentPacketRes): Promise<void> {
		await handleCommandGuildRecruitmentPacketRes(packet, context);
	}

	@packetHandler(CommandGuildRecruitmentErrorPacket)
	async guildRecruitmentError(context: PacketContext, packet: CommandGuildRecruitmentErrorPacket): Promise<void> {
		await handleClassicError(context, `commands:guildRecruitment.errors.${packet.error}`);
	}

	@packetHandler(CommandGuildRecruitmentListPacketRes)
	async guildRecruitmentListRes(context: PacketContext, packet: CommandGuildRecruitmentListPacketRes): Promise<void> {
		await handleCommandGuildRecruitmentListPacketRes(packet, context);
	}

	@packetHandler(CommandGuildJoinPacketRes)
	async guildJoinRes(context: PacketContext, packet: CommandGuildJoinPacketRes): Promise<void> {
		await handleCommandGuildJoinPacketRes(packet, context);
	}

	@packetHandler(CommandGuildJoinErrorPacket)
	async guildJoinError(context: PacketContext, packet: CommandGuildJoinErrorPacket): Promise<void> {
		await handleClassicError(context, `commands:guildJoin.errors.${packet.error}`, { minScore: packet.minScore });
	}
}
