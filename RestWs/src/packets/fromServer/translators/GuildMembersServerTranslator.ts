import { fromServerTranslator } from "../FromServerTranslator";
import { resolvePlayerName } from "../PlayerDisplay";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandGuildInvitePendingPacket, CommandGuildInviteAcceptPacketRes, CommandGuildInviteRefusePacketRes,
	CommandGuildInvitePlayerNotFound, CommandGuildInviteInvitingPlayerNotInGuild, CommandGuildInviteLevelTooLow,
	CommandGuildInviteGuildIsFull, CommandGuildInviteInvitedPlayerIsDead, CommandGuildInviteInvitedPlayerIsOnPveIsland,
	CommandGuildInviteAlreadyInAGuild
} from "../../../../../Lib/src/packets/commands/CommandGuildInvitePacket";
import {
	CommandGuildElderAcceptPacketRes, CommandGuildElderRefusePacketRes, CommandGuildElderFoundPlayerPacketRes,
	CommandGuildElderSameGuildPacketRes, CommandGuildElderHimselfPacketRes, CommandGuildElderAlreadyElderPacketRes
} from "../../../../../Lib/src/packets/commands/CommandGuildElderPacket";
import {
	CommandGuildElderRemoveAcceptPacketRes, CommandGuildElderRemoveRefusePacketRes, CommandGuildElderRemoveNoElderPacket
} from "../../../../../Lib/src/packets/commands/CommandGuildElderRemovePacket";
import {
	CommandGuildKickAcceptPacketRes, CommandGuildKickRefusePacketRes, CommandGuildKickPacketRes, CommandGuildKickBlockedErrorPacket
} from "../../../../../Lib/src/packets/commands/CommandGuildKickPacket";
import { RequirementGuildRolePacket } from "../../../../../Lib/src/packets/commands/requirements/RequirementGuildRolePacket";
import { GuildCommandRes } from "../../../../../WsPackets/src/fromServer/guild/GuildRes";
import {
	GUILD_MEMBER_ACTIONS, GUILD_MEMBER_ERRORS, GuildMemberAction, GuildMemberError
} from "../../../../../WsPackets/src/objects/Guild";
import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";
import { CommandRejected } from "../../../../../WsPackets/src/fromServer/common/CommandRejected";
import { COMMAND_REJECTIONS } from "../../../../../WsPackets/src/objects/CommandRejection";

async function memberAction(action: GuildMemberAction, memberId: string, guildName?: string): Promise<GuildCommandRes> {
	const memberName = await resolvePlayerName(memberId);
	return asyncMakeFromServerPacket(GuildCommandRes, { outcome: {
		type: "memberAction", action, ...guildName ? { guildName } : {}, ...memberName ? { memberName } : {}
	} });
}
function memberError(error: GuildMemberError): Promise<GuildCommandRes> {
	return asyncMakeFromServerPacket(GuildCommandRes, { outcome: {
		type: "memberError", error
	} });
}
function cancelled(): Promise<GuildCommandRes> {
	return asyncMakeFromServerPacket(GuildCommandRes, { outcome: { type: "cancelled" } });
}

export default class GuildMembersServerTranslator {
	@fromServerTranslator(CommandGuildInvitePendingPacket, GuildCommandRes)
	public static invited(_context: PacketContext, packet: CommandGuildInvitePendingPacket): Promise<GuildCommandRes> {
		return memberAction(GUILD_MEMBER_ACTIONS.INVITED, packet.invitedPlayerKeycloakId, packet.guildName);
	}

	@fromServerTranslator(CommandGuildInviteAcceptPacketRes, GuildCommandRes)
	public static joined(_context: PacketContext, packet: CommandGuildInviteAcceptPacketRes): Promise<GuildCommandRes> {
		return memberAction(GUILD_MEMBER_ACTIONS.JOINED, packet.invitedPlayerKeycloakId, packet.guildName);
	}

	@fromServerTranslator(CommandGuildInviteRefusePacketRes, GuildCommandRes)
	public static refused(_context: PacketContext, packet: CommandGuildInviteRefusePacketRes): Promise<GuildCommandRes> {
		return memberAction(GUILD_MEMBER_ACTIONS.REFUSED, packet.invitedPlayerKeycloakId, packet.guildName);
	}

	@fromServerTranslator(CommandGuildElderAcceptPacketRes, GuildCommandRes)
	public static promoted(_context: PacketContext, packet: CommandGuildElderAcceptPacketRes): Promise<GuildCommandRes> {
		return memberAction(GUILD_MEMBER_ACTIONS.PROMOTED, packet.promotedKeycloakId, packet.guildName);
	}

	@fromServerTranslator(CommandGuildElderRemoveAcceptPacketRes, GuildCommandRes)
	public static demoted(_context: PacketContext, packet: CommandGuildElderRemoveAcceptPacketRes): Promise<GuildCommandRes> {
		return memberAction(GUILD_MEMBER_ACTIONS.DEMOTED, packet.demotedKeycloakId, packet.guildName);
	}

	@fromServerTranslator(CommandGuildKickAcceptPacketRes, GuildCommandRes)
	public static kicked(_context: PacketContext, packet: CommandGuildKickAcceptPacketRes): Promise<GuildCommandRes> {
		return memberAction(GUILD_MEMBER_ACTIONS.KICKED, packet.kickedKeycloakId, packet.guildName);
	}

	@fromServerTranslator(CommandGuildKickPacketRes, GuildCommandRes)
	public static kickError(_context: PacketContext, packet: CommandGuildKickPacketRes): Promise<GuildCommandRes> {
		const error = !packet.foundPlayer ? GUILD_MEMBER_ERRORS.NOT_FOUND : packet.himself ? GUILD_MEMBER_ERRORS.SELF : GUILD_MEMBER_ERRORS.SAME_GUILD;
		return memberError(error);
	}

	@fromServerTranslator(RequirementGuildRolePacket, CommandRejected)
	public static role(_context: PacketContext, packet: RequirementGuildRolePacket): Promise<CommandRejected> {
		return asyncMakeFromServerPacket(CommandRejected, { rejection: {
			type: COMMAND_REJECTIONS.GUILD_ROLE, role: packet.roleNeeded
		} });
	}

	@fromServerTranslator(CommandGuildInvitePlayerNotFound, GuildCommandRes)
	public static notFound(_context: PacketContext, _packet: CommandGuildInvitePlayerNotFound): Promise<GuildCommandRes> {
		return memberError(GUILD_MEMBER_ERRORS.NOT_FOUND);
	}

	@fromServerTranslator(CommandGuildInviteInvitingPlayerNotInGuild, GuildCommandRes)
	public static noGuild(_context: PacketContext, _packet: CommandGuildInviteInvitingPlayerNotInGuild): Promise<GuildCommandRes> {
		return memberError(GUILD_MEMBER_ERRORS.NO_GUILD);
	}

	@fromServerTranslator(CommandGuildInviteLevelTooLow, GuildCommandRes)
	public static lowLevel(_context: PacketContext, _packet: CommandGuildInviteLevelTooLow): Promise<GuildCommandRes> {
		return memberError(GUILD_MEMBER_ERRORS.LEVEL);
	}

	@fromServerTranslator(CommandGuildInviteGuildIsFull, GuildCommandRes)
	public static full(_context: PacketContext, _packet: CommandGuildInviteGuildIsFull): Promise<GuildCommandRes> {
		return memberError(GUILD_MEMBER_ERRORS.FULL);
	}

	@fromServerTranslator(CommandGuildInviteInvitedPlayerIsDead, GuildCommandRes)
	public static dead(_context: PacketContext, _packet: CommandGuildInviteInvitedPlayerIsDead): Promise<GuildCommandRes> {
		return memberError(GUILD_MEMBER_ERRORS.DEAD);
	}

	@fromServerTranslator(CommandGuildInviteInvitedPlayerIsOnPveIsland, GuildCommandRes)
	public static island(_context: PacketContext, _packet: CommandGuildInviteInvitedPlayerIsOnPveIsland): Promise<GuildCommandRes> {
		return memberError(GUILD_MEMBER_ERRORS.ISLAND);
	}

	@fromServerTranslator(CommandGuildInviteAlreadyInAGuild, GuildCommandRes)
	public static alreadyMember(_context: PacketContext, _packet: CommandGuildInviteAlreadyInAGuild): Promise<GuildCommandRes> {
		return memberError(GUILD_MEMBER_ERRORS.ALREADY_MEMBER);
	}

	@fromServerTranslator(CommandGuildElderFoundPlayerPacketRes, GuildCommandRes)
	public static elderNotFound(_context: PacketContext, _packet: CommandGuildElderFoundPlayerPacketRes): Promise<GuildCommandRes> {
		return memberError(GUILD_MEMBER_ERRORS.NOT_FOUND);
	}

	@fromServerTranslator(CommandGuildElderSameGuildPacketRes, GuildCommandRes)
	public static wrongGuild(_context: PacketContext, _packet: CommandGuildElderSameGuildPacketRes): Promise<GuildCommandRes> {
		return memberError(GUILD_MEMBER_ERRORS.SAME_GUILD);
	}

	@fromServerTranslator(CommandGuildElderHimselfPacketRes, GuildCommandRes)
	public static self(_context: PacketContext, _packet: CommandGuildElderHimselfPacketRes): Promise<GuildCommandRes> {
		return memberError(GUILD_MEMBER_ERRORS.SELF);
	}

	@fromServerTranslator(CommandGuildElderAlreadyElderPacketRes, GuildCommandRes)
	public static alreadyElder(_context: PacketContext, _packet: CommandGuildElderAlreadyElderPacketRes): Promise<GuildCommandRes> {
		return memberError(GUILD_MEMBER_ERRORS.ALREADY_ELDER);
	}

	@fromServerTranslator(CommandGuildElderRemoveNoElderPacket, GuildCommandRes)
	public static noElder(_context: PacketContext, _packet: CommandGuildElderRemoveNoElderPacket): Promise<GuildCommandRes> {
		return memberError(GUILD_MEMBER_ERRORS.NO_ELDER);
	}

	@fromServerTranslator(CommandGuildKickBlockedErrorPacket, GuildCommandRes)
	public static blocked(_context: PacketContext, _packet: CommandGuildKickBlockedErrorPacket): Promise<GuildCommandRes> {
		return memberError(GUILD_MEMBER_ERRORS.BLOCKED);
	}

	@fromServerTranslator(CommandGuildKickRefusePacketRes, GuildCommandRes)
	public static cancelKick(_context: PacketContext, _packet: CommandGuildKickRefusePacketRes): Promise<GuildCommandRes> {
		return cancelled();
	}

	@fromServerTranslator(CommandGuildElderRefusePacketRes, GuildCommandRes)
	public static cancelPromotion(_context: PacketContext, _packet: CommandGuildElderRefusePacketRes): Promise<GuildCommandRes> {
		return cancelled();
	}

	@fromServerTranslator(CommandGuildElderRemoveRefusePacketRes, GuildCommandRes)
	public static cancelDemotion(_context: PacketContext, _packet: CommandGuildElderRemoveRefusePacketRes): Promise<GuildCommandRes> {
		return cancelled();
	}
}
