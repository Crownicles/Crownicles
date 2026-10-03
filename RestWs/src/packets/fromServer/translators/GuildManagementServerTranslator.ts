import { fromServerTranslator } from "../FromServerTranslator";
import { resolvePlayerName } from "../PlayerDisplay";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandGuildDescriptionAcceptPacketRes, CommandGuildDescriptionRefusePacketRes,
	CommandGuildDescriptionInvalidPacket, CommandGuildDescriptionNoGuildPacket, CommandGuildDescriptionNotAnElderPacket
} from "../../../../../Lib/src/packets/commands/CommandGuildDescriptionPacket";
import {
	CommandGuildLeaveAcceptPacketRes, CommandGuildLeaveRefusePacketRes, CommandGuildLeaveNotInAGuildPacketRes
} from "../../../../../Lib/src/packets/commands/CommandGuildLeavePacket";
import { GuildCommandRes } from "../../../../../WsPackets/src/fromServer/guild/GuildRes";
import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";

export default class GuildManagementServerTranslator {
	@fromServerTranslator(CommandGuildDescriptionAcceptPacketRes, GuildCommandRes)
	public static description(_context: PacketContext, _packet: CommandGuildDescriptionAcceptPacketRes): Promise<GuildCommandRes> {
		return asyncMakeFromServerPacket(GuildCommandRes, { outcome: { type: "descriptionUpdated" } });
	}

	@fromServerTranslator(CommandGuildDescriptionInvalidPacket, GuildCommandRes)
	public static invalid(_context: PacketContext, packet: CommandGuildDescriptionInvalidPacket): Promise<GuildCommandRes> {
		return asyncMakeFromServerPacket(GuildCommandRes, { outcome: {
			type: "descriptionInvalid", min: packet.min, max: packet.max
		} });
	}

	@fromServerTranslator(CommandGuildDescriptionRefusePacketRes, GuildCommandRes)
	public static refuseDescription(_context: PacketContext, _packet: CommandGuildDescriptionRefusePacketRes): Promise<GuildCommandRes> {
		return asyncMakeFromServerPacket(GuildCommandRes, { outcome: { type: "cancelled" } });
	}

	@fromServerTranslator(CommandGuildDescriptionNoGuildPacket, GuildCommandRes)
	public static noGuild(_context: PacketContext, _packet: CommandGuildDescriptionNoGuildPacket): Promise<GuildCommandRes> {
		return asyncMakeFromServerPacket(GuildCommandRes, { outcome: { type: "notInGuild" } });
	}

	@fromServerTranslator(CommandGuildDescriptionNotAnElderPacket, GuildCommandRes)
	public static forbidden(_context: PacketContext, _packet: CommandGuildDescriptionNotAnElderPacket): Promise<GuildCommandRes> {
		return asyncMakeFromServerPacket(GuildCommandRes, { outcome: { type: "forbidden" } });
	}

	@fromServerTranslator(CommandGuildLeaveAcceptPacketRes, GuildCommandRes)
	public static async left(_context: PacketContext, packet: CommandGuildLeaveAcceptPacketRes): Promise<GuildCommandRes> {
		const newChiefName = await resolvePlayerName(packet.newChiefKeycloakId);
		return asyncMakeFromServerPacket(GuildCommandRes, { outcome: {
			type: "left",
			guildName: packet.guildName,
			...packet.isGuildDestroyed === undefined ? {} : { isGuildDestroyed: packet.isGuildDestroyed },
			...newChiefName ? { newChiefName } : {}
		} });
	}

	@fromServerTranslator(CommandGuildLeaveNotInAGuildPacketRes, GuildCommandRes)
	public static notInGuild(_context: PacketContext, _packet: CommandGuildLeaveNotInAGuildPacketRes): Promise<GuildCommandRes> {
		return asyncMakeFromServerPacket(GuildCommandRes, { outcome: { type: "notInGuild" } });
	}

	@fromServerTranslator(CommandGuildLeaveRefusePacketRes, GuildCommandRes)
	public static refuseLeave(_context: PacketContext, _packet: CommandGuildLeaveRefusePacketRes): Promise<GuildCommandRes> {
		return asyncMakeFromServerPacket(GuildCommandRes, { outcome: { type: "cancelled" } });
	}
}
