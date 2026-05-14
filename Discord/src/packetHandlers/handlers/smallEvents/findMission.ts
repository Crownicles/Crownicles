import { packetHandler } from "../../PacketHandler";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../../../bot/DiscordCache";
import { CrowniclesSmallEventEmbed } from "../../../messages/CrowniclesSmallEventEmbed";
import { StringUtils } from "../../../utils/StringUtils";
import { getRandomSmallEventIntro } from "../../../utils/SmallEventUtils";
import { SmallEventFindMissionPacket } from "../../../../../Lib/src/packets/smallEvents/SmallEventFindMissionPacket";
import { MissionUtils } from "../../../utils/MissionUtils";

export default class FindMissionSmallEventHandler {
	@packetHandler(SmallEventFindMissionPacket)
	async smallEventFindMission(context: PacketContext, packet: SmallEventFindMissionPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		const lng = interaction!.userLanguage;
		await interaction?.editReply({
			embeds: [
				new CrowniclesSmallEventEmbed(
					"findMission",
					`${
						getRandomSmallEventIntro(lng)
					}${
						StringUtils.getRandomTranslation("smallEvents:findMission.intrigue", lng)
					}\n\n**${
						MissionUtils.formatBaseMission(packet.mission, lng)
					}**`,
					interaction.user,
					lng
				)
			]
		});
	}
}
