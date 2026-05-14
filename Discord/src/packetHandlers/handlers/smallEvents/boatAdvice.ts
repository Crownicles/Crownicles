import { packetHandler } from "../../PacketHandler";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../../../bot/DiscordCache";
import { CrowniclesSmallEventEmbed } from "../../../messages/CrowniclesSmallEventEmbed";
import { StringUtils } from "../../../utils/StringUtils";
import { SmallEventBoatAdvicePacket } from "../../../../../Lib/src/packets/smallEvents/SmallEventBoatAdvicePacket";

export default class BoatAdviceSmallEventHandler {
	@packetHandler(SmallEventBoatAdvicePacket)
	async smallEventBoatAdvice(context: PacketContext, _packet: SmallEventBoatAdvicePacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		if (!interaction) {
			return;
		}
		const lng = interaction.userLanguage;
		const description = StringUtils.getRandomTranslation(
			"smallEvents:boatAdvice.intro",
			lng,
			{ advice: StringUtils.getRandomTranslation("smallEvents:boatAdvice.advices", lng) }
		);
		await interaction.editReply({ embeds: [new CrowniclesSmallEventEmbed("boatAdvice", description, interaction.user, lng)] });
	}
}
