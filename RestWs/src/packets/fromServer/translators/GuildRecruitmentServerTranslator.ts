import { fromServerTranslator } from "../FromServerTranslator";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandGuildJoinErrorPacket,
	CommandGuildJoinPacketRes,
	CommandGuildRecruitmentErrorPacket,
	CommandGuildRecruitmentListPacketRes,
	CommandGuildRecruitmentPacketRes
} from "../../../../../Lib/src/packets/commands/CommandGuildRecruitmentPacket";
import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";
import {
	GuildJoinErrorRes, GuildJoinRes, GuildRecruitmentErrorRes, GuildRecruitmentListRes, GuildRecruitmentRes
} from "../../../../../WsPackets/src/fromServer/guild/GuildRecruitmentRes";

export default class GuildRecruitmentServerTranslator {
	@fromServerTranslator(CommandGuildRecruitmentPacketRes, GuildRecruitmentRes)
	public static settings(_context: PacketContext, packet: CommandGuildRecruitmentPacketRes): Promise<GuildRecruitmentRes> {
		return asyncMakeFromServerPacket(GuildRecruitmentRes, {
			settings: packet.settings, changed: packet.changed
		});
	}

	@fromServerTranslator(CommandGuildRecruitmentErrorPacket, GuildRecruitmentErrorRes)
	public static settingsError(_context: PacketContext, packet: CommandGuildRecruitmentErrorPacket): Promise<GuildRecruitmentErrorRes> {
		return asyncMakeFromServerPacket(GuildRecruitmentErrorRes, { error: packet.error });
	}

	@fromServerTranslator(CommandGuildRecruitmentListPacketRes, GuildRecruitmentListRes)
	public static list(_context: PacketContext, packet: CommandGuildRecruitmentListPacketRes): Promise<GuildRecruitmentListRes> {
		return asyncMakeFromServerPacket(GuildRecruitmentListRes, {
			guilds: packet.guilds,
			playerScore: packet.playerScore,
			...packet.search === undefined ? {} : { search: packet.search }
		});
	}

	@fromServerTranslator(CommandGuildJoinPacketRes, GuildJoinRes)
	public static joined(_context: PacketContext, packet: CommandGuildJoinPacketRes): Promise<GuildJoinRes> {
		return asyncMakeFromServerPacket(GuildJoinRes, { guildName: packet.guildName });
	}

	@fromServerTranslator(CommandGuildJoinErrorPacket, GuildJoinErrorRes)
	public static joinError(_context: PacketContext, packet: CommandGuildJoinErrorPacket): Promise<GuildJoinErrorRes> {
		return asyncMakeFromServerPacket(GuildJoinErrorRes, {
			error: packet.error,
			...packet.minScore === undefined ? {} : { minScore: packet.minScore }
		});
	}
}
