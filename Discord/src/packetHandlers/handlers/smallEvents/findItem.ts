import { packetHandler } from "../../PacketHandler";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../../../bot/DiscordCache";
import { CrowniclesSmallEventEmbed } from "../../../messages/CrowniclesSmallEventEmbed";
import { StringUtils } from "../../../utils/StringUtils";
import { getRandomSmallEventIntro } from "../../../utils/SmallEventUtils";
import { SmallEventFindItemPacket } from "../../../../../Lib/src/packets/smallEvents/SmallEventFindItemPacket";

export default class FindItemSmallEventHandler {
	@packetHandler(SmallEventFindItemPacket)
	async smallEventFindItem(context: PacketContext, _packet: SmallEventFindItemPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		const lng = interaction!.userLanguage;
		await interaction?.editReply({
			embeds: [
				new CrowniclesSmallEventEmbed(
					"findItem",
					getRandomSmallEventIntro(lng)
					+ StringUtils.getRandomTranslation("smallEvents:findItem.stories", lng),
					interaction.user,
					lng
				)
			]
		});
	}
}
