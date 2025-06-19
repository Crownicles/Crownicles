import { PacketContext } from "../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../bot/DiscordCache";
import { CrowniclesSmallEventEmbed } from "../messages/CrowniclesSmallEventEmbed";
import { StringUtils } from "../utils/StringUtils";

export async function infoFightResult(context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);
	const lng = interaction!.userLanguage;
	const intro = StringUtils.getRandomTranslation("smallEvents:infoFight.intro", lng);
	const description = StringUtils.getRandomTranslation("smallEvents:infoFight.fightActions", lng);
	await interaction?.editReply({
		embeds: [
			new CrowniclesSmallEventEmbed(
				"infoFight",
				intro + description,
				interaction.user,
				lng
			)
		]
	});
}
