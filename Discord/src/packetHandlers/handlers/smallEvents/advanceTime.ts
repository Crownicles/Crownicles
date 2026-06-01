import { packetHandler } from "../../PacketHandler";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { SmallEventAdvanceTimePacket } from "../../../../../Lib/src/packets/smallEvents/SmallEventAdvanceTimePacket";
import { DiscordCache } from "../../../bot/DiscordCache";
import { CrowniclesSmallEventEmbed } from "../../../messages/CrowniclesSmallEventEmbed";
import { StringUtils } from "../../../utils/StringUtils";
import { getRandomSmallEventIntro } from "../../../utils/SmallEventUtils";
import i18n from "../../../translations/i18n";

export default class AdvanceTimeSmallEventHandler {
	@packetHandler(SmallEventAdvanceTimePacket)
	async smallEventAdvanceTime(context: PacketContext, packet: SmallEventAdvanceTimePacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		if (!interaction) {
			return;
		}
		const lng = interaction.userLanguage;
		const timeDisplay = i18n.formatDuration(packet.amount, lng);
		const description = getRandomSmallEventIntro(lng)
			+ StringUtils.getRandomTranslation("smallEvents:advanceTime.stories", lng, {
				time: packet.amount,
				timeDisplay
			});
		await interaction.editReply({ embeds: [new CrowniclesSmallEventEmbed("advanceTime", description, interaction.user, lng)] });
	}
}
