import { packetHandler } from "../../PacketHandler";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../../../bot/DiscordCache";
import { CrowniclesSmallEventEmbed } from "../../../messages/CrowniclesSmallEventEmbed";
import { StringUtils } from "../../../utils/StringUtils";
import { getRandomSmallEventIntro } from "../../../utils/SmallEventUtils";
import { SmallEventWinHealthPacket } from "../../../../../Lib/src/packets/smallEvents/SmallEventWinHealthPacket";

export default class WinHealthSmallEventHandler {
	@packetHandler(SmallEventWinHealthPacket)
	async smallEventWinHealth(context: PacketContext, packet: SmallEventWinHealthPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		const lng = interaction!.userLanguage;
		await interaction?.editReply({
			embeds: [
				new CrowniclesSmallEventEmbed(
					"winHealth",
					getRandomSmallEventIntro(lng)
					+ StringUtils.getRandomTranslation("smallEvents:winHealth.stories", lng, { health: packet.amount }),
					interaction.user,
					lng
				)
			]
		});
	}
}
