import { packetHandler } from "../../PacketHandler";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../../../bot/DiscordCache";
import { CrowniclesSmallEventEmbed } from "../../../messages/CrowniclesSmallEventEmbed";
import { StringUtils } from "../../../utils/StringUtils";
import { getRandomSmallEventIntro } from "../../../utils/SmallEventUtils";
import { SmallEventFarmerPacket } from "../../../../../Lib/src/packets/smallEvents/SmallEventFarmerPacket";
import { Language } from "../../../../../Lib/src/Language";

/**
 * Build the farmer small event description (intro + story + reward)
 */
export function buildFarmerDescription(interactionName: string, amount: number | undefined, lng: Language): string {
	return getRandomSmallEventIntro(lng)
		+ StringUtils.getRandomTranslation("smallEvents:farmer.stories", lng)
		+ StringUtils.getRandomTranslation(`smallEvents:farmer.rewards.${interactionName}`, lng, { count: amount });
}

export default class FarmerSmallEventHandler {
	@packetHandler(SmallEventFarmerPacket)
	async smallEventFarmer(context: PacketContext, packet: SmallEventFarmerPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		const lng = interaction!.userLanguage;

		await interaction?.editReply({
			embeds: [
				new CrowniclesSmallEventEmbed(
					"farmer",
					buildFarmerDescription(packet.interactionName, packet.amount, lng),
					interaction.user,
					lng
				)
			]
		});
	}
}
