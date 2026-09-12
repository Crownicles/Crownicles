import { fromServerTranslator } from "../FromServerTranslator";
import { resolvePlayerName } from "../PlayerDisplay";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { CommandGuildPacketRes } from "../../../../../Lib/src/packets/commands/CommandGuildPacket";
import { CommandGuildStoragePacketRes } from "../../../../../Lib/src/packets/commands/CommandGuildStoragePacket";
import {
	CommandGuildCreatePacketRes, CommandGuildCreateAcceptPacketRes, CommandGuildCreateRefusePacketRes
} from "../../../../../Lib/src/packets/commands/CommandGuildCreatePacket";
import {
	CommandGuildDailyRewardPacket, CommandGuildDailyCooldownErrorPacket, CommandGuildDailyPveIslandErrorPacket
} from "../../../../../Lib/src/packets/commands/CommandGuildDailyPacket";
import { GuildMember as LibGuildMember } from "../../../../../Lib/src/types/GuildMember";
import { GuildMember } from "../../../../../WsPackets/src/objects/Guild";
import {
	GuildRes, GuildStorageRes, GuildCommandRes
} from "../../../../../WsPackets/src/fromServer/guild/GuildRes";
import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";

async function guildMember(member: LibGuildMember, context: PacketContext): Promise<GuildMember> {
	const {
		keycloakId, ...data
	} = member;
	const name = await resolvePlayerName(keycloakId);
	return {
		...data, isSelf: keycloakId === context.keycloakId, ...name ? { name } : {}
	};
}
export default class GuildServerTranslator {
	@fromServerTranslator(CommandGuildPacketRes, GuildRes)
	public static async info(context: PacketContext, packet: CommandGuildPacketRes): Promise<GuildRes> {
		const data = packet.data
			? {
				...packet.data, members: await Promise.all(packet.data.members.map(member => guildMember(member, context)))
			}
			: null;
		return asyncMakeFromServerPacket(GuildRes, {
			foundGuild: packet.foundGuild, ...data ? { data } : {}
		});
	}

	@fromServerTranslator(CommandGuildStoragePacketRes, GuildStorageRes)
	public static storage(_context: PacketContext, packet: CommandGuildStoragePacketRes): Promise<GuildStorageRes> {
		return asyncMakeFromServerPacket(GuildStorageRes, { ...packet });
	}

	@fromServerTranslator(CommandGuildCreatePacketRes, GuildCommandRes)
	public static creationStatus(_context: PacketContext, packet: CommandGuildCreatePacketRes): Promise<GuildCommandRes> {
		return asyncMakeFromServerPacket(GuildCommandRes, { outcome: {
			type: "creationStatus", status: { ...packet }
		} });
	}

	@fromServerTranslator(CommandGuildCreateAcceptPacketRes, GuildCommandRes)
	public static created(_context: PacketContext, packet: CommandGuildCreateAcceptPacketRes): Promise<GuildCommandRes> {
		return asyncMakeFromServerPacket(GuildCommandRes, { outcome: {
			type: "created", guildName: packet.guildName
		} });
	}

	@fromServerTranslator(CommandGuildCreateRefusePacketRes, GuildCommandRes)
	public static cancelled(_context: PacketContext, _packet: CommandGuildCreateRefusePacketRes): Promise<GuildCommandRes> {
		return asyncMakeFromServerPacket(GuildCommandRes, { outcome: { type: "cancelled" } });
	}

	@fromServerTranslator(CommandGuildDailyRewardPacket, GuildCommandRes)
	public static daily(_context: PacketContext, packet: CommandGuildDailyRewardPacket): Promise<GuildCommandRes> {
		return asyncMakeFromServerPacket(GuildCommandRes, { outcome: {
			type: "daily", reward: { ...packet }
		} });
	}

	@fromServerTranslator(CommandGuildDailyCooldownErrorPacket, GuildCommandRes)
	public static dailyCooldown(_context: PacketContext, packet: CommandGuildDailyCooldownErrorPacket): Promise<GuildCommandRes> {
		return asyncMakeFromServerPacket(GuildCommandRes, { outcome: {
			type: "dailyCooldown", ...packet
		} });
	}

	@fromServerTranslator(CommandGuildDailyPveIslandErrorPacket, GuildCommandRes)
	public static dailyIsland(_context: PacketContext, _packet: CommandGuildDailyPveIslandErrorPacket): Promise<GuildCommandRes> {
		return asyncMakeFromServerPacket(GuildCommandRes, { outcome: { type: "dailyIsland" } });
	}
}
