import { packetHandler } from "../../PacketHandler";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../../../bot/DiscordCache";
import { CrowniclesSmallEventEmbed } from "../../../messages/CrowniclesSmallEventEmbed";
import { StringUtils } from "../../../utils/StringUtils";
import { getRandomSmallEventIntro } from "../../../utils/SmallEventUtils";
import { CrowniclesIcons } from "../../../../../Lib/src/CrowniclesIcons";
import { SmallEventUltimateFoodMerchantPacket } from "../../../../../Lib/src/packets/smallEvents/SmallEventUltimateFoodMerchantPacket";

export default class UltimateFoodMerchantSmallEventHandler {
	@packetHandler(SmallEventUltimateFoodMerchantPacket)
	async smallEventUltimateFoodMerchant(context: PacketContext, packet: SmallEventUltimateFoodMerchantPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		const lng = interaction!.userLanguage;
		await interaction?.editReply({
			embeds: [
				new CrowniclesSmallEventEmbed(
					"ultimateFoodMerchant",
					getRandomSmallEventIntro(lng)
					+ StringUtils.getRandomTranslation("smallEvents:ultimateFoodMerchant.stories", lng)
					+ StringUtils.getRandomTranslation(`smallEvents:ultimateFoodMerchant.rewards.${packet.interactionName}`, lng, {
						count: packet.amount,
						moneyEmote: CrowniclesIcons.unitValues.money
					}),
					interaction.user,
					lng
				)
			]
		});
	}
}
