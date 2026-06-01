import { packetHandler } from "../../PacketHandler";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../../../bot/DiscordCache";
import { CrowniclesSmallEventEmbed } from "../../../messages/CrowniclesSmallEventEmbed";
import { StringUtils } from "../../../utils/StringUtils";
import i18n from "../../../translations/i18n";
import { SmallEventWinGuildXPPacket } from "../../../../../Lib/src/packets/smallEvents/SmallEventWinGuildXPPacket";

export default class WinGuildXPSmallEventHandler {
	@packetHandler(SmallEventWinGuildXPPacket)
	async smallEventWinGuildXp(context: PacketContext, packet: SmallEventWinGuildXPPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		const lng = interaction!.userLanguage;
		await interaction?.editReply({
			embeds: [
				new CrowniclesSmallEventEmbed(
					"winGuildXP",
					`${StringUtils.getRandomTranslation("smallEvents:winGuildXP.stories", lng, { guild: packet.guildName })}${i18n.t("smallEvents:winGuildXP.end", {
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
