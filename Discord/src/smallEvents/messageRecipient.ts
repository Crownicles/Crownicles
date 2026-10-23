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

export async function messageRecipientResult(
	context: PacketContext,
	packet: SmallEventMessageRecipientPacket
): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);
	if (!interaction) {
		return;
	}
	const lng = interaction.userLanguage;
	const chosenEmote = packet.chosenEmoji ? (CrowniclesIcons.messageEmojis[packet.chosenEmoji] ?? "") : "";

	let resultText = "";
	switch (packet.outcome) {
		case SmallEventConstants.MESSAGE.OUTCOMES.SUCCESS:
			resultText = i18n.t("smallEvents:messageRecipient.results.success", {
				lng,
				emoji: chosenEmote,
				money: packet.moneyWon ?? 0,
				xp: packet.xpWon ?? 0
			});
			break;
		case SmallEventConstants.MESSAGE.OUTCOMES.WRONG_BOMB:
			resultText = i18n.t("smallEvents:messageRecipient.results.wrongBomb", {
				lng,
				emoji: chosenEmote,
				health: packet.damage ?? 0
			});
			break;
		case SmallEventConstants.MESSAGE.OUTCOMES.WRONG_TIME:
			resultText = i18n.t("smallEvents:messageRecipient.results.wrongTime", {
				lng,
				emoji: chosenEmote,
				time: i18n.formatDuration(packet.timeLost ?? 0, lng)
			});
			break;
		case SmallEventConstants.MESSAGE.OUTCOMES.WRONG_POO:
			resultText = i18n.t("smallEvents:messageRecipient.results.wrongPoo", {
				lng,
				emoji: chosenEmote
			});
			break;
		case SmallEventConstants.MESSAGE.OUTCOMES.WRONG_LOVE:
			resultText = i18n.t("smallEvents:messageRecipient.results.wrongLove", {
				lng,
				emoji: chosenEmote
			});
			break;
		case SmallEventConstants.MESSAGE.OUTCOMES.TIMEOUT:
			resultText = i18n.t("smallEvents:messageRecipient.results.timeout", {
				lng
			});
			break;
		default:
			resultText = i18n.t("smallEvents:messageRecipient.results.wrongGeneric", {
				lng,
				emoji: chosenEmote
			});
			break;
	}

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
				.setDescription(resultText)
		]
	});
}
