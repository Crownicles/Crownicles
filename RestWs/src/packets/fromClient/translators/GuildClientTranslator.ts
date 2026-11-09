import { fromClientTranslator } from "../FromClientTranslator";
import { InvalidClientPacketError } from "../InvalidClientPacketError";
import { resolveAskedPlayer } from "../AskedPlayerResolver";
import {
	asyncMakePacket, PacketContext
} from "../../../../../Lib/src/packets/CrowniclesPacket";
import { CommandGuildPacketReq } from "../../../../../Lib/src/packets/commands/CommandGuildPacket";
import { CommandGuildCreatePacketReq } from "../../../../../Lib/src/packets/commands/CommandGuildCreatePacket";
import { CommandGuildStoragePacketReq } from "../../../../../Lib/src/packets/commands/CommandGuildStoragePacket";
import { CommandGuildDailyPacketReq } from "../../../../../Lib/src/packets/commands/CommandGuildDailyPacket";
import {
	GuildReq, GuildCreateReq, GuildStorageReq, GuildDailyReq
} from "../../../../../WsPackets/src/fromClient/GuildReq";

function validateGuildName(name: unknown): asserts name is string {
	if (typeof name !== "string") {
		throw new InvalidClientPacketError("Invalid guild name");
	}
}
export default class GuildClientTranslator {
	@fromClientTranslator(GuildReq)
	public static info(context: PacketContext, packet: GuildReq): Promise<CommandGuildPacketReq> {
		if (packet.askedGuildName !== undefined) {
			validateGuildName(packet.askedGuildName);
		}
		return asyncMakePacket(CommandGuildPacketReq, {
			askedPlayer: resolveAskedPlayer(context, packet.askedPlayer), ...packet.askedGuildName === undefined ? {} : { askedGuildName: packet.askedGuildName }
		});
	}

	@fromClientTranslator(GuildCreateReq)
	public static create(context: PacketContext, packet: GuildCreateReq): Promise<CommandGuildCreatePacketReq> {
		validateGuildName(packet.askedGuildName);
		return asyncMakePacket(CommandGuildCreatePacketReq, {
			keycloakId: context.keycloakId!, askedGuildName: packet.askedGuildName
		});
	}

	@fromClientTranslator(GuildStorageReq)
	public static storage(_context: PacketContext, _packet: GuildStorageReq): Promise<CommandGuildStoragePacketReq> {
		return asyncMakePacket(CommandGuildStoragePacketReq, {});
	}

	@fromClientTranslator(GuildDailyReq)
	public static daily(_context: PacketContext, _packet: GuildDailyReq): Promise<CommandGuildDailyPacketReq> {
		return asyncMakePacket(CommandGuildDailyPacketReq, {});
	}
}
