import { fromServerTranslator } from "../FromServerTranslator";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { CommandRarityPacketRes } from "../../../../../Lib/src/packets/commands/CommandRarityPacket";
import {
	CommandBlessingPacketRes, RequirementOracleNotMetPacket
} from "../../../../../Lib/src/packets/commands/CommandBlessingPacket";
import { RarityRes } from "../../../../../WsPackets/src/fromServer/character/RarityRes";
import { BlessingRes } from "../../../../../WsPackets/src/fromServer/character/BlessingRes";
import { CommandRejected } from "../../../../../WsPackets/src/fromServer/common/CommandRejected";
import { COMMAND_REJECTIONS } from "../../../../../WsPackets/src/objects/CommandRejection";
import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";
import { resolvePlayerName } from "../PlayerDisplay";

export default class CharacterCommandServerTranslator {
	@fromServerTranslator(CommandRarityPacketRes, RarityRes)
	public static rarity(_context: PacketContext, packet: CommandRarityPacketRes): Promise<RarityRes> {
		return asyncMakeFromServerPacket(RarityRes, { rarities: packet.rarities });
	}

	@fromServerTranslator(CommandBlessingPacketRes, BlessingRes)
	public static async blessing(_context: PacketContext, packet: CommandBlessingPacketRes): Promise<BlessingRes> {
		const {
			lastTriggeredByKeycloakId, topContributorKeycloakId, ...data
		} = packet;
		const [lastTriggeredBy, topContributor] = await Promise.all([resolvePlayerName(lastTriggeredByKeycloakId), resolvePlayerName(topContributorKeycloakId)]);
		return asyncMakeFromServerPacket(BlessingRes, {
			...data,
			...lastTriggeredBy ? { lastTriggeredBy } : {},
			...topContributor ? { topContributor } : {}
		});
	}

	@fromServerTranslator(RequirementOracleNotMetPacket, CommandRejected)
	public static oracle(_context: PacketContext, _packet: RequirementOracleNotMetPacket): Promise<CommandRejected> {
		return asyncMakeFromServerPacket(CommandRejected, { rejection: { type: COMMAND_REJECTIONS.ORACLE } });
	}
}
