import { fromServerTranslator } from "../FromServerTranslator";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandMissionPlayerNotFoundPacket, CommandMissionsPacketRes
} from "../../../../../Lib/src/packets/commands/CommandMissionsPacket";
import { MissionsRes } from "../../../../../WsPackets/src/fromServer/missions/MissionsRes";
import { PlayerNotFound } from "../../../../../WsPackets/src/fromServer/common/PlayerNotFound";
import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";
import { missionData } from "../MissionDisplay";

export default class MissionsCommandServerTranslator {
	@fromServerTranslator(CommandMissionsPacketRes, MissionsRes)
	public static translate(_context: PacketContext, packet: CommandMissionsPacketRes): Promise<MissionsRes> {
		return asyncMakeFromServerPacket(MissionsRes, {
			missions: packet.missions.map(missionData),
			campaignProgression: packet.campaignProgression,
			maxCampaignNumber: packet.maxCampaignNumber,
			maxSideMissionSlots: packet.maxSideMissionSlots,
			dailyMission: packet.dailyMission
		});
	}

	@fromServerTranslator(CommandMissionPlayerNotFoundPacket, PlayerNotFound)
	public static notFound(_context: PacketContext, _packet: CommandMissionPlayerNotFoundPacket): Promise<PlayerNotFound> {
		return asyncMakeFromServerPacket(PlayerNotFound, {});
	}
}
