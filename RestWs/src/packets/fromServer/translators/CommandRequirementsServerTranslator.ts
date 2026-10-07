import { fromServerTranslator } from "../FromServerTranslator";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { RequirementLevelPacket } from "../../../../../Lib/src/packets/commands/requirements/RequirementLevelPacket";
import { RequirementEffectPacket } from "../../../../../Lib/src/packets/commands/requirements/RequirementEffectPacket";
import { RequirementWherePacket } from "../../../../../Lib/src/packets/commands/requirements/RequirementWherePacket";
import { RequirementGuildNeededPacket } from "../../../../../Lib/src/packets/commands/requirements/RequirementGuildNeededPacket";
import { CommandRejected } from "../../../../../WsPackets/src/fromServer/common/CommandRejected";
import { COMMAND_REJECTIONS } from "../../../../../WsPackets/src/objects/CommandRejection";
import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";

export default class CommandRequirementsServerTranslator {
	@fromServerTranslator(RequirementGuildNeededPacket, CommandRejected)
	public static guild(_context: PacketContext, _packet: RequirementGuildNeededPacket): Promise<CommandRejected> {
		return asyncMakeFromServerPacket(CommandRejected, { rejection: { type: COMMAND_REJECTIONS.GUILD } });
	}

	@fromServerTranslator(RequirementLevelPacket, CommandRejected)
	public static level(_context: PacketContext, packet: RequirementLevelPacket): Promise<CommandRejected> {
		return asyncMakeFromServerPacket(CommandRejected, { rejection: {
			type: COMMAND_REJECTIONS.LEVEL, requiredLevel: packet.requiredLevel
		} });
	}

	@fromServerTranslator(RequirementEffectPacket, CommandRejected)
	public static effect(_context: PacketContext, packet: RequirementEffectPacket): Promise<CommandRejected> {
		return asyncMakeFromServerPacket(CommandRejected, { rejection: {
			type: COMMAND_REJECTIONS.EFFECT, currentEffectId: packet.currentEffectId, remainingTime: packet.remainingTime
		} });
	}

	@fromServerTranslator(RequirementWherePacket, CommandRejected)
	public static location(_context: PacketContext, _packet: RequirementWherePacket): Promise<CommandRejected> {
		return asyncMakeFromServerPacket(CommandRejected, { rejection: { type: COMMAND_REJECTIONS.LOCATION } });
	}
}
