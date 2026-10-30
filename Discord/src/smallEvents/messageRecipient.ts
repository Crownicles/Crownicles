import { PacketContext } from "../../../Lib/src/packets/CrowniclesPacket";
import { ReactionCollectorMessageRecipientPacket } from "../../../Lib/src/packets/interaction/ReactionCollectorMessageRecipient";
import { SmallEventMessageRecipientPacket } from "../../../Lib/src/packets/smallEvents/SmallEventMessageRecipientPacket";
import { DiscordCache } from "../bot/DiscordCache";
import { CrowniclesSmallEventEmbed } from "../messages/CrowniclesSmallEventEmbed";
import { CrowniclesEmbed } from "../messages/CrowniclesEmbed";
import { getRandomSmallEventIntro } from "../utils/SmallEventUtils";
import i18n from "../translations/i18n";
import { CrowniclesIcons } from "../../../Lib/src/CrowniclesIcons";
import {
	CrowniclesButtonReaction, CrowniclesButtonReactionMessage
} from "../messages/CrowniclesButtonReactionMessage";
import { ReactionCollectorReturnTypeOrNull } from "../packetHandlers/handlers/ReactionCollectorHandlers";
import { Language } from "../../../Lib/src/Language";
import { SmallEventConstants } from "../../../Lib/src/constants/SmallEventConstants";
import { escapeUsername } from "../utils/StringUtils";

function getMessageRecipientReactions(packet: ReactionCollectorMessageRecipientPacket, lng: Language): CrowniclesButtonReaction[] {
	return packet.reactions.map(r => {
		const emojiId = r.data.emojiId;
		const emote = CrowniclesIcons.messageEmojis[emojiId] ?? "";
		return {
			customId: emojiId,
			emote,
			description: i18n.t(`smallEvents:messageRecipient.emojis.${emojiId}`, { lng })
		};
	});
}

export async function messageRecipientCollector(
	context: PacketContext,
	packet: ReactionCollectorMessageRecipientPacket
): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
	const lng = interaction.userLanguage;
	const destinationName = i18n.t(`models:map_locations.${packet.data.data.destinationLocationId}.name`, { lng });

	return await new CrowniclesButtonReactionMessage(interaction, {
		reactions: getMessageRecipientReactions(packet, lng),
		embed: new CrowniclesSmallEventEmbed(
			"messageRecipient",
			`${getRandomSmallEventIntro(lng)}${i18n.t("smallEvents:messageRecipient.intro", {
				lng,
				destination: destinationName
			})}`,
			interaction.user,
			lng
		),
		packet,
		context,
		canEndReact: true
	}).send();
}

/**
 * The outcome values are also the translation keys of the results, so unknown outcomes fall back to the generic one
 */
function getMessageRecipientResultText(packet: SmallEventMessageRecipientPacket, lng: Language): string {
	const outcomes: string[] = Object.values(SmallEventConstants.MESSAGE.OUTCOMES);
	const outcome = outcomes.includes(packet.outcome) ? packet.outcome : SmallEventConstants.MESSAGE.OUTCOMES.WRONG_GENERIC;

	return i18n.t(`smallEvents:messageRecipient.results.${outcome}`, {
		lng,
		emoji: packet.chosenEmoji ? CrowniclesIcons.messageEmojis[packet.chosenEmoji] ?? "" : "",
		money: packet.moneyWon ?? 0,
		xp: packet.xpWon ?? 0,
		health: packet.damage ?? 0,
		time: i18n.formatDuration(packet.timeLost ?? 0, lng)
	});
}

export async function messageRecipientResult(
	context: PacketContext,
	packet: SmallEventMessageRecipientPacket
): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);
	if (!interaction) {
		return;
	}
	const lng = interaction.userLanguage;

	await interaction.followUp({
		embeds: [
			new CrowniclesEmbed()
				.formatAuthor(
					i18n.t("commands:report.journal", {
						lng,
						pseudo: escapeUsername(interaction.user.displayName)
					}),
					interaction.user
				)
				.setDescription(getMessageRecipientResultText(packet, lng))
		]
	});
}
