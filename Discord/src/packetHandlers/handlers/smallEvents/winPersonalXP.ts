import { packetHandler } from "../../PacketHandler";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../../../bot/DiscordCache";
import { CrowniclesSmallEventEmbed } from "../../../messages/CrowniclesSmallEventEmbed";
import { StringUtils } from "../../../utils/StringUtils";
import { getRandomSmallEventIntro } from "../../../utils/SmallEventUtils";
import i18n from "../../../translations/i18n";
import { SmallEventWinPersonalXPPacket } from "../../../../../Lib/src/packets/smallEvents/SmallEventWinPersonalXPPacket";

export default class WinPersonalXPSmallEventHandler {
	@packetHandler(SmallEventWinPersonalXPPacket)
	async smallEventWinPersonalXP(context: PacketContext, packet: SmallEventWinPersonalXPPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		const lng = interaction!.userLanguage;
		await interaction?.editReply({
			embeds: [
				new CrowniclesSmallEventEmbed(
					"winPersonalXP",
					`${getRandomSmallEventIntro(lng)}${StringUtils.getRandomTranslation("smallEvents:winPersonalXP.stories", lng)}${i18n.t("smallEvents:winPersonalXP.end", {
						lng,
						xp: packet.amount
					})}`,
					interaction.user,
					lng
				)
			]
		});
	}
}
