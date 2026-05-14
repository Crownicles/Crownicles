import { packetHandler } from "../../PacketHandler";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../../../bot/DiscordCache";
import { CrowniclesSmallEventEmbed } from "../../../messages/CrowniclesSmallEventEmbed";
import { StringUtils } from "../../../utils/StringUtils";
import { getRandomSmallEventIntro } from "../../../utils/SmallEventUtils";
import { SmallEventClassPacket } from "../../../../../Lib/src/packets/smallEvents/SmallEventClassPacket";

export default class ClassSmallEventHandler {
	@packetHandler(SmallEventClassPacket)
	async smallEventClass(context: PacketContext, packet: SmallEventClassPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		const lng = interaction!.userLanguage;
		await interaction?.editReply({
			embeds: [
				new CrowniclesSmallEventEmbed(
					"class",
					getRandomSmallEventIntro(lng)
					+ StringUtils.getRandomTranslation(`smallEvents:class.${packet.classKind}.${packet.interactionName}`, lng, {
						amount: packet.amount
					}),
					interaction.user,
					lng
				)
			]
		});
	}
}
