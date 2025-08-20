import { PacketContext } from "../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../bot/DiscordCache";
import { CrowniclesSmallEventEmbed } from "../messages/CrowniclesSmallEventEmbed";
import { StringUtils } from "../utils/StringUtils";
import { SmallEventInfoFightPacket } from "../../../Lib/src/packets/smallEvents/SmallEventInfoFightPacket";
import i18n from "../translations/i18n";

export async function infoFightResult(context: PacketContext, packet: SmallEventInfoFightPacket): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);
	const lng = interaction!.userLanguage;
	const intro = StringUtils.getRandomTranslation("smallEvents:infoFight.intro", lng);

	let description: string;

	if (packet.showHandednessInfo) {
		const handednessKey = packet.isLeftHanded ? "leftHanded" : "rightHanded";
		description = i18n.t(`smallEvents:infoFight.handednessDescription.${handednessKey}`, { lng });
	}
	else {
		description = StringUtils.getRandomTranslation("smallEvents:infoFight.fightActions", lng);
	}

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
