import { ReactionCollectorCreationPacket } from "../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { PacketContext } from "../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../bot/DiscordCache";
import { CrowniclesSmallEventEmbed } from "../messages/CrowniclesSmallEventEmbed";
import { getRandomSmallEventIntro } from "../utils/SmallEventUtils";
import i18n from "../translations/i18n";
import { CrowniclesIcons } from "../../../Lib/src/CrowniclesIcons";
import {
	CrowniclesButtonReaction, CrowniclesButtonReactionMessage
} from "../messages/CrowniclesButtonReactionMessage";
import { ReactionCollectorReturnTypeOrNull } from "../packetHandlers/handlers/ReactionCollectorHandlers";
import { Language } from "../../../Lib/src/Language";

/**
 * Get the reactions for the goblet game
 * @param lng
 */
function getGobletsGameReactions(lng: Language): CrowniclesButtonReaction[] {
	const reactions: CrowniclesButtonReaction[] = [];
	for (const [customId, emote] of Object.entries(CrowniclesIcons.goblets)) {
		reactions.push({
			customId,
			emote,
			description: i18n.t(`smallEvents:gobletsGame.goblets.${customId}.description`, { lng })
		});
	}
	return reactions;
}

/**
 * Send the goblet game message
 * @param packet
 * @param context
 */
export async function gobletsGameCollector(context: PacketContext, packet: ReactionCollectorCreationPacket): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
	const lng = interaction.userLanguage;

	return await new CrowniclesButtonReactionMessage(interaction, {
		reactions: getGobletsGameReactions(lng),
		embed: new CrowniclesSmallEventEmbed(
			"gobletsGame",
			`${getRandomSmallEventIntro(lng)}${i18n.t("smallEvents:gobletsGame.intro", { lng })}`,
			interaction.user,
			lng
		),
		packet,
		context,
		canEndReact: true
	}).send();
}
