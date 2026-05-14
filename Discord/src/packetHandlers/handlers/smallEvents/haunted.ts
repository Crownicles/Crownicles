import { packetHandler } from "../../PacketHandler";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../../../bot/DiscordCache";
import { CrowniclesSmallEventEmbed } from "../../../messages/CrowniclesSmallEventEmbed";
import { StringUtils } from "../../../utils/StringUtils";
import { SmallEventHauntedPacket } from "../../../../../Lib/src/packets/smallEvents/SmallEventHauntedPacket";

export default class HauntedSmallEventHandler {
	@packetHandler(SmallEventHauntedPacket)
	async smallEventHaunted(context: PacketContext, _packet: SmallEventHauntedPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		if (!interaction) {
			return;
		}
		const lng = interaction.userLanguage;
		const description = StringUtils.getRandomTranslation("smallEvents:haunted", lng);
		await interaction.editReply({ embeds: [new CrowniclesSmallEventEmbed("haunted", description, interaction.user, lng)] });
	}
}
