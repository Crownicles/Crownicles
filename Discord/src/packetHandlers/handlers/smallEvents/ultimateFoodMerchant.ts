import { packetHandler } from "../../PacketHandler";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../../../bot/DiscordCache";
import { CrowniclesSmallEventEmbed } from "../../../messages/CrowniclesSmallEventEmbed";
import { StringUtils } from "../../../utils/StringUtils";
import { getRandomSmallEventIntro } from "../../../utils/SmallEventUtils";
import { CrowniclesIcons } from "../../../../../Lib/src/CrowniclesIcons";
import { SmallEventUltimateFoodMerchantPacket } from "../../../../../Lib/src/packets/smallEvents/SmallEventUltimateFoodMerchantPacket";
import { Language } from "../../../../../Lib/src/Language";

/**
 * Build the ultimate food merchant small event description (intro + story + reward)
 */
export function buildUltimateFoodMerchantDescription(interactionName: string, amount: number | undefined, lng: Language): string {
	return getRandomSmallEventIntro(lng)
		+ StringUtils.getRandomTranslation("smallEvents:ultimateFoodMerchant.stories", lng)
		+ StringUtils.getRandomTranslation(`smallEvents:ultimateFoodMerchant.rewards.${interactionName}`, lng, {
			count: amount,
			moneyEmote: CrowniclesIcons.unitValues.money
		});
}

export default class UltimateFoodMerchantSmallEventHandler {
	@packetHandler(SmallEventUltimateFoodMerchantPacket)
	async smallEventUltimateFoodMerchant(context: PacketContext, packet: SmallEventUltimateFoodMerchantPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		const lng = interaction!.userLanguage;
		await interaction?.editReply({
			embeds: [
				new CrowniclesSmallEventEmbed(
					"ultimateFoodMerchant",
					buildUltimateFoodMerchantDescription(packet.interactionName, packet.amount, lng),
					interaction.user,
					lng
				)
			]
		});
	}
}
