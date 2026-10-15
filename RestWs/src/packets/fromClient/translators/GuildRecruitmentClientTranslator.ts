import { fromClientTranslator } from "../FromClientTranslator";
import { InvalidClientPacketError } from "../InvalidClientPacketError";
import {
	asyncMakePacket, PacketContext
} from "../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandGuildJoinPacketReq, CommandGuildRecruitmentListPacketReq, CommandGuildRecruitmentPacketReq
} from "../../../../../Lib/src/packets/commands/CommandGuildRecruitmentPacket";
import { GuildRecruitmentConstants } from "../../../../../Lib/src/constants/GuildRecruitmentConstants";
import {
	GuildJoinReq, GuildRecruitmentListReq, GuildRecruitmentReq
} from "../../../../../WsPackets/src/fromClient/GuildRecruitmentReq";

function checkSettings(packet: GuildRecruitmentReq): void {
	if (packet.open !== undefined && typeof packet.open !== "boolean") {
		throw new InvalidClientPacketError("Invalid recruitment status");
	}
	if (packet.minScore !== undefined && !GuildRecruitmentConstants.isMinScoreStep(packet.minScore)) {
		throw new InvalidClientPacketError("Invalid recruitment minimum score");
	}
}

/** No search at all asks for suggestions; otherwise it must be a string short enough for Core. */
function isValidSearch(search: unknown): boolean {
	if (search === undefined) {
		return true;
	}
	return typeof search === "string" && search.length <= GuildRecruitmentConstants.SEARCH_MAX_LENGTH;
}

export default class GuildRecruitmentClientTranslator {
	@fromClientTranslator(GuildRecruitmentReq)
	public static settings(_context: PacketContext, packet: GuildRecruitmentReq): Promise<CommandGuildRecruitmentPacketReq> {
		checkSettings(packet);
		return asyncMakePacket(CommandGuildRecruitmentPacketReq, {
			...packet.open === undefined ? {} : { open: packet.open },
			...packet.minScore === undefined ? {} : { minScore: packet.minScore }
		});
	}

	@fromClientTranslator(GuildRecruitmentListReq)
	public static list(_context: PacketContext, packet: GuildRecruitmentListReq): Promise<CommandGuildRecruitmentListPacketReq> {
		if (!isValidSearch(packet.search)) {
			throw new InvalidClientPacketError("Invalid guild search");
		}
		return asyncMakePacket(CommandGuildRecruitmentListPacketReq, packet.search ? { search: packet.search } : {});
	}

	@fromClientTranslator(GuildJoinReq)
	public static join(_context: PacketContext, packet: GuildJoinReq): Promise<CommandGuildJoinPacketReq> {
		if (!Number.isSafeInteger(packet.guildId) || packet.guildId <= 0) {
			throw new InvalidClientPacketError("Invalid guild id");
		}
		return asyncMakePacket(CommandGuildJoinPacketReq, { guildId: packet.guildId });
	}
}
