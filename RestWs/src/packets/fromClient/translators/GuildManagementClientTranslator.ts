import { fromClientTranslator } from "../FromClientTranslator";
import { InvalidClientPacketError } from "../InvalidClientPacketError";
import {
	asyncMakePacket, PacketContext
} from "../../../../../Lib/src/packets/CrowniclesPacket";
import { CommandGuildDescriptionPacketReq } from "../../../../../Lib/src/packets/commands/CommandGuildDescriptionPacket";
import { CommandGuildLeavePacketReq } from "../../../../../Lib/src/packets/commands/CommandGuildLeavePacket";
import { CommandGuildInvitePacketReq } from "../../../../../Lib/src/packets/commands/CommandGuildInvitePacket";
import { CommandGuildElderPacketReq } from "../../../../../Lib/src/packets/commands/CommandGuildElderPacket";
import { CommandGuildElderRemovePacketReq } from "../../../../../Lib/src/packets/commands/CommandGuildElderRemovePacket";
import { CommandGuildKickPacketReq } from "../../../../../Lib/src/packets/commands/CommandGuildKickPacket";
import {
	GuildDescriptionReq, GuildLeaveReq, GuildInviteReq, GuildPromoteReq, GuildDemoteReq, GuildKickReq
} from "../../../../../WsPackets/src/fromClient/GuildManagementReq";

function validateMemberRank(rank: number): void {
	if (!Number.isSafeInteger(rank) || rank < 1) {
		throw new InvalidClientPacketError("Invalid player rank");
	}
}

export default class GuildManagementClientTranslator {
	@fromClientTranslator(GuildInviteReq)
	public static invite(_context: PacketContext, packet: GuildInviteReq): Promise<CommandGuildInvitePacketReq> {
		validateMemberRank(packet.rank);
		return asyncMakePacket(CommandGuildInvitePacketReq, {
			invitedPlayerKeycloakId: "", invitedPlayerRank: packet.rank
		});
	}

	@fromClientTranslator(GuildPromoteReq)
	public static promote(_context: PacketContext, packet: GuildPromoteReq): Promise<CommandGuildElderPacketReq> {
		validateMemberRank(packet.rank);
		return asyncMakePacket(CommandGuildElderPacketReq, {
			askedPlayerKeycloakId: "", askedPlayerRank: packet.rank
		});
	}

	@fromClientTranslator(GuildDemoteReq)
	public static demote(_context: PacketContext, _packet: GuildDemoteReq): Promise<CommandGuildElderRemovePacketReq> {
		return asyncMakePacket(CommandGuildElderRemovePacketReq, {});
	}

	@fromClientTranslator(GuildKickReq)
	public static kick(_context: PacketContext, packet: GuildKickReq): Promise<CommandGuildKickPacketReq> {
		validateMemberRank(packet.rank);
		return asyncMakePacket(CommandGuildKickPacketReq, { askedPlayer: { rank: packet.rank } });
	}

	@fromClientTranslator(GuildDescriptionReq)
	public static description(_context: PacketContext, packet: GuildDescriptionReq): Promise<CommandGuildDescriptionPacketReq> {
		if (typeof packet.description !== "string") {
			throw new InvalidClientPacketError("Invalid guild description");
		}
		return asyncMakePacket(CommandGuildDescriptionPacketReq, { description: packet.description });
	}

	@fromClientTranslator(GuildLeaveReq)
	public static leave(_context: PacketContext, _packet: GuildLeaveReq): Promise<CommandGuildLeavePacketReq> {
		return asyncMakePacket(CommandGuildLeavePacketReq, {});
	}
}
