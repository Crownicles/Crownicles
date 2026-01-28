import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	Player, Players
} from "../../core/database/game/models/Player";
import {
	CommandMissionPlayerNotFoundPacket,
	CommandMissionsPacketReq,
	CommandMissionsPacketRes
} from "../../../../Lib/src/packets/commands/CommandMissionsPacket";
import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import { MissionSlots } from "../../core/database/game/models/MissionSlot";
import { PlayerMissionsInfos } from "../../core/database/game/models/PlayerMissionsInfo";
import { MissionType } from "../../../../Lib/src/types/CompletedMission";
import { DailyMissions } from "../../core/database/game/models/DailyMission";
import { Campaign } from "../../core/missions/Campaign";
import { MissionsController } from "../../core/missions/MissionsController";

export default class MissionsCommand {
	@commandRequires(CommandMissionsPacketReq, {
		notBlocked: false,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE
	})
	async execute(response: CrowniclesPacket[], player: Player, packet: CommandMissionsPacketReq, context: PacketContext): Promise<void> {
		const toCheckPlayer = packet.askedPlayer.keycloakId
			? packet.askedPlayer.keycloakId === context.keycloakId
				? player
				: await Players.getByKeycloakId(packet.askedPlayer.keycloakId)
			: await Players.getByRank(packet.askedPlayer.rank!);

		if (!toCheckPlayer?.hasStartedToPlay()) {
			response.push(makePacket(CommandMissionPlayerNotFoundPacket, {}));
			return;
		}

		if (toCheckPlayer.id === player.id) {
			await MissionsController.update(player, response, { missionId: "commandMission" });
		}

		const missionInfo = await PlayerMissionsInfos.getOfPlayer(toCheckPlayer.id);

		const baseMissions = MissionsController.prepareMissionSlots(await MissionSlots.getOfPlayer(toCheckPlayer.id));

		baseMissions.push(MissionsController.prepareBaseMission({
			...(await DailyMissions.getOrGenerate())!.toJSON(),

			/*
			 * We are using the expiresAt field to store the last time the daily mission was completed,
			 * And the front-end will use the data to calculate the time left to complete it
			 */
			expiresAt: new Date(missionInfo.lastDailyMissionCompleted).toString(),
			missionType: MissionType.DAILY,
			numberDone: missionInfo.dailyMissionNumberDone
		}));

		response.push(makePacket(CommandMissionsPacketRes, {
			keycloakId: toCheckPlayer.keycloakId,
			missions: baseMissions,
			maxCampaignNumber: Campaign.getMaxCampaignNumber(),
			campaignProgression: missionInfo.campaignProgression,
			maxSideMissionSlots: toCheckPlayer.getMissionSlotsNumber()
		}));
	}
}
