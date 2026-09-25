import { fromServerTranslator } from "../FromServerTranslator";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { MissionsCompletedPacket } from "../../../../../Lib/src/packets/events/MissionsCompletedPacket";
import { CompletedMission as LibCompletedMission } from "../../../../../Lib/src/types/CompletedMission";
import { MissionsCompletedRes } from "../../../../../WsPackets/src/fromServer/missions/MissionsCompletedRes";
import { CompletedMission } from "../../../../../WsPackets/src/objects/Mission";
import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";
import { missionData } from "../MissionDisplay";

function completedMission({
	pointsToWin, xpToWin, gemsToWin, moneyToWin, petRewardTypeId, ...mission
}: LibCompletedMission): CompletedMission {
	return {
		mission: missionData(mission),
		reward: {
			points: pointsToWin,
			experience: xpToWin,
			gems: gemsToWin,
			money: moneyToWin,
			...petRewardTypeId === undefined ? {} : { petRewardTypeId }
		}
	};
}

export default class MissionsCompletedServerTranslator {
	@fromServerTranslator(MissionsCompletedPacket, MissionsCompletedRes)
	public static translate(_context: PacketContext, packet: MissionsCompletedPacket): Promise<MissionsCompletedRes> {
		return asyncMakeFromServerPacket(MissionsCompletedRes, {
			missions: packet.missions.map(completedMission),
			...packet.nextCampaignMission ? { nextCampaignMission: missionData(packet.nextCampaignMission) } : {},
			...packet.discoveredRecipes ? { discoveredRecipes: packet.discoveredRecipes } : {}
		});
	}
}
