import { packetHandler } from "../../PacketHandler";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../../../bot/DiscordCache";
import { CrowniclesSmallEventEmbed } from "../../../messages/CrowniclesSmallEventEmbed";
import { StringUtils } from "../../../utils/StringUtils";
import { getRandomSmallEventIntro } from "../../../utils/SmallEventUtils";
import i18n from "../../../translations/i18n";
import { SmallEventBotFactsPacket } from "../../../../../Lib/src/packets/smallEvents/SmallEventBotFactsPacket";
import { DisplayUtils } from "../../../utils/DisplayUtils";

export default class BotFactsSmallEventHandler {
	@packetHandler(SmallEventBotFactsPacket)
	async smallEventBotFacts(context: PacketContext, packet: SmallEventBotFactsPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		const lng = interaction!.userLanguage;
		await interaction?.editReply({
			embeds: [
				new CrowniclesSmallEventEmbed(
					"botFacts",
					getRandomSmallEventIntro(lng)
					+ StringUtils.getRandomTranslation("smallEvents:botFacts.stories", lng, {
						botFact: i18n.t(`smallEvents:botFacts.possibleInfo.${packet.information}`, {
							lng,
							count: packet.infoNumber,
							infoNumber: packet.infoNumber,
							infoComplement: DisplayUtils.getClassDisplay(packet.infoComplement ? packet.infoComplement : 0, lng)
						})
					}),
					interaction.user,
					lng
				)
			]
		});
	}
}
