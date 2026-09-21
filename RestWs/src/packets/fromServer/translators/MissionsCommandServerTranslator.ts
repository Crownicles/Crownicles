import { fromServerTranslator } from "../FromServerTranslator";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandMissionPlayerNotFoundPacket, CommandMissionsPacketRes
} from "../../../../../Lib/src/packets/commands/CommandMissionsPacket";
import { BaseMission } from "../../../../../Lib/src/types/CompletedMission";
import { MissionUtils } from "../../../../../Lib/src/utils/MissionUtils";
import { getRiskCategoryName } from "../../../../../Lib/src/utils/ExpeditionUtils";
import {
	Mission, MISSION_VARIANTS
} from "../../../../../WsPackets/src/objects/Mission";
import { MissionsRes } from "../../../../../WsPackets/src/fromServer/missions/MissionsRes";
import { PlayerNotFound } from "../../../../../WsPackets/src/fromServer/common/PlayerNotFound";
import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";

export function missionData(mission: BaseMission): Mission {
	const {
		saveBlob, ...data
	} = mission;
	if (mission.missionId === MISSION_VARIANTS.EXPEDITION_RISK) {
		return {
			...data, riskCategory: getRiskCategoryName(mission.missionVariant)
		};
	}
	if (mission.missionId !== MISSION_VARIANTS.TRAVEL) {
		return data;
	}
	const progress = saveBlob ? MissionUtils.fromPlaceToPlaceDataFromSaveBlob(Buffer.from(saveBlob, "binary")) : null;
	return {
		...data,
		travel: {
			...MissionUtils.fromPlaceToPlaceParamsFromVariant(mission.missionVariant),
			...progress ? { progress } : {}
		}
	};
}

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
