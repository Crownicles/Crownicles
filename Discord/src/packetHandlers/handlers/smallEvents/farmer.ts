import { packetHandler } from "../../PacketHandler";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../../../bot/DiscordCache";
import { CrowniclesSmallEventEmbed } from "../../../messages/CrowniclesSmallEventEmbed";
import { StringUtils } from "../../../utils/StringUtils";
import {
	buildRecipeDiscoveryMessage, getRandomSmallEventIntro
} from "../../../utils/SmallEventUtils";
import { SmallEventFarmerPacket } from "../../../../../Lib/src/packets/smallEvents/SmallEventFarmerPacket";

export default class FarmerSmallEventHandler {
	@packetHandler(SmallEventFarmerPacket)
	async smallEventFarmer(context: PacketContext, packet: SmallEventFarmerPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		const lng = interaction!.userLanguage;

		const description = getRandomSmallEventIntro(lng)
			+ StringUtils.getRandomTranslation("smallEvents:farmer.stories", lng)
			+ StringUtils.getRandomTranslation(`smallEvents:farmer.rewards.${packet.interactionName}`, lng, { count: packet.amount })
			+ (packet.discoveredRecipeId ? `\n\n${buildRecipeDiscoveryMessage(packet.discoveredRecipeId, lng, packet.recipeCost)}` : "");

		await interaction?.editReply({
			embeds: [
				new CrowniclesSmallEventEmbed(
					"farmer",
					description,
					interaction.user,
					lng
				)
			]
		});
	}
}
