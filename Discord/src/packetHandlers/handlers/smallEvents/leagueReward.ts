import { packetHandler } from "../../PacketHandler";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../../../bot/DiscordCache";
import { CrowniclesSmallEventEmbed } from "../../../messages/CrowniclesSmallEventEmbed";
import { StringUtils } from "../../../utils/StringUtils";
import { getRandomSmallEventIntro } from "../../../utils/SmallEventUtils";
import i18n from "../../../translations/i18n";
import { SmallEventLeagueRewardPacket } from "../../../../../Lib/src/packets/smallEvents/SmallEventLeagueReward";
import { printTimeBeforeDate } from "../../../../../Lib/src/utils/TimeUtils";

export default class LeagueRewardSmallEventHandler {
	@packetHandler(SmallEventLeagueRewardPacket)
	async smallEventLeagueReward(context: PacketContext, packet: SmallEventLeagueRewardPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		if (!interaction) {
			return;
		}
		const lng = interaction.userLanguage;
		const endMessage = i18n.t(`smallEvents:leagueReward.${packet.rewardToday ? "rewardToday" : packet.enoughFights ? "endMessage" : "notEnoughFight"}`, {
			lng,
			leagueId: packet.leagueId,
			rewards: i18n.t("smallEvents:leagueReward.reward", {
				lng,
				money: packet.money,
				xp: packet.xp
			}),
			time: printTimeBeforeDate(packet.nextRewardDate)
		});
		await interaction.editReply({
			embeds: [
				new CrowniclesSmallEventEmbed(
					"leagueReward",
					getRandomSmallEventIntro(lng) + StringUtils.getRandomTranslation("smallEvents:leagueReward.intrigue", lng) + endMessage,
					interaction.user,
					lng
				)
			]
		});
	}
}
