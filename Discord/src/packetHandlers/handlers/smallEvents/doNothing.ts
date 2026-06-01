import { packetHandler } from "../../PacketHandler";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../../../bot/DiscordCache";
import { CrowniclesSmallEventEmbed } from "../../../messages/CrowniclesSmallEventEmbed";
import { StringUtils } from "../../../utils/StringUtils";
import { SmallEventDoNothingPacket } from "../../../../../Lib/src/packets/smallEvents/SmallEventDoNothingPacket";

export default class DoNothingSmallEventHandler {
	@packetHandler(SmallEventDoNothingPacket)
	async smallEventDoNothing(context: PacketContext, _packet: SmallEventDoNothingPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		await interaction?.editReply({
			embeds: [
				new CrowniclesSmallEventEmbed(
					"doNothing",
					StringUtils.getRandomTranslation("smallEvents:doNothing.stories", interaction.userLanguage),
					interaction.user,
					interaction.userLanguage
				)
			]
		});
	}
}
