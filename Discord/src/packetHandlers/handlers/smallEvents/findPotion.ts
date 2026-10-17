import { packetHandler } from "../../PacketHandler";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../../../bot/DiscordCache";
import { CrowniclesSmallEventEmbed } from "../../../messages/CrowniclesSmallEventEmbed";
import { StringUtils } from "../../../utils/StringUtils";
import { getRandomSmallEventIntro } from "../../../utils/SmallEventUtils";
import { SmallEventFindPotionPacket } from "../../../../../Lib/src/packets/smallEvents/SmallEventFindPotionPacket";

export default class FindPotionSmallEventHandler {
	@packetHandler(SmallEventFindPotionPacket)
	async smallEventFindPotion(context: PacketContext, _packet: SmallEventFindPotionPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		const lng = interaction!.userLanguage;
		await interaction?.editReply({
			embeds: [
				new CrowniclesSmallEventEmbed(
					"findPotion",
					getRandomSmallEventIntro(lng)
					+ StringUtils.getRandomTranslation("smallEvents:findPotion.stories", lng),
					interaction.user,
					lng
				)
			]
		});
	}
}
