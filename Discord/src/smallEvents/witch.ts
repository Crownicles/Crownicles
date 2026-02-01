import { PacketContext } from "../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../bot/DiscordCache";
import { CrowniclesSmallEventEmbed } from "../messages/CrowniclesSmallEventEmbed";
import i18n from "../translations/i18n";
import { DiscordCollectorUtils } from "../utils/DiscordCollectorUtils";
import {
	ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, Message, parseEmoji
} from "discord.js";
import { CrowniclesIcons } from "../../../Lib/src/CrowniclesIcons";
import { sendInteractionNotForYou } from "../utils/ErrorUtils";
import { ReactionCollectorWitchPacket } from "../../../Lib/src/packets/interaction/ReactionCollectorWitch";
import { getRandomSmallEventIntro } from "../utils/SmallEventUtils";
import { StringUtils } from "../utils/StringUtils";
import { SmallEventWitchResultPacket } from "../../../Lib/src/packets/smallEvents/SmallEventWitchPacket";
import { Effect } from "../../../Lib/src/types/Effect";
import { WitchActionOutcomeType } from "../../../Lib/src/types/WitchActionOutcomeType";
import { ReactionCollectorReturnTypeOrNull } from "../packetHandlers/handlers/ReactionCollectorHandlers";
import { MessagesUtils } from "../utils/MessagesUtils";

export async function witchCollector(context: PacketContext, packet: ReactionCollectorWitchPacket): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
	const lng = interaction.userLanguage;

	let witchIngredients = "\n\n";
	const reactions: [string, string][] = [];
	for (const reaction of packet.reactions) {
		const ingredientId = reaction.data.id;
		const emoji = CrowniclesIcons.witchSmallEvent[ingredientId];
		witchIngredients += `${emoji} ${i18n.t(`smallEvents:witch.witchEventNames.${ingredientId}`, { lng })}\n`;
		reactions.push([ingredientId, emoji]);
	}

	const intro = getRandomSmallEventIntro(lng);
	const embed = new CrowniclesSmallEventEmbed(
		"witch",
		intro
		+ StringUtils.getRandomTranslation("smallEvents:witch.intro", lng)
		+ StringUtils.getRandomTranslation("smallEvents:witch.description", lng)
		+ StringUtils.getRandomTranslation("smallEvents:witch.situation", lng)
		+ witchIngredients,
		interaction.user,
		lng
	);

	const row = new ActionRowBuilder<ButtonBuilder>();

	// Create buttons
	for (const reaction of reactions) {
		const button = new ButtonBuilder()
			.setEmoji(parseEmoji(reaction[1])!)
			.setCustomId(reaction[0])
			.setStyle(ButtonStyle.Secondary);
		row.addComponents(button);
	}

	// Edit message
	const msg = await interaction?.editReply({
		embeds: [embed],
		components: [row]
	}) as Message;

	// Create a button collector
	const buttonCollector = msg.createMessageComponentCollector({
		time: packet.endTime - Date.now()
	});

	// Send an error if someone uses the collector that is not intended for them and stop if it's the owner
	buttonCollector.on("collect", async (buttonInteraction: ButtonInteraction) => {
		if (buttonInteraction.user.id !== context.discord?.user) {
			await sendInteractionNotForYou(buttonInteraction.user, buttonInteraction, lng);
			return;
		}

		await buttonInteraction.deferReply();
		DiscordCollectorUtils.sendReaction(
			packet,
			context,
			context.keycloakId!,
			buttonInteraction,
			packet.reactions.findIndex(reaction => reaction.data.id === buttonInteraction.customId)
		);
	});

	buttonCollector.on("end", async () => {
		// Disable buttons instead of removing them
		row.components.forEach(component => {
			component.setDisabled(true);
		});

		await msg.edit({ components: [row] });
	});

	return [buttonCollector];
}

export async function witchResult(packet: SmallEventWitchResultPacket, context: PacketContext): Promise<void> {
	const interaction = MessagesUtils.getCurrentInteraction(context);
	if (!interaction) {
		return;
	}
	const lng = context.discord!.language;
	const introToLoad = packet.isIngredient ? "smallEvents:witch.witchEventResults.ingredientIntros" : "smallEvents:witch.witchEventResults.adviceIntros";
	const isTimePenalty = packet.effectId === Effect.OCCUPIED.id && packet.timeLost > 0;
	const lostTimeDisplay = isTimePenalty ? i18n.formatDuration(packet.timeLost, lng) : null;
	const timeOutro = isTimePenalty
		? ` ${StringUtils.getRandomTranslation("smallEvents:witch.witchEventResults.outcomes.2.time", lng, {
			lostTime: packet.timeLost,
			lostTimeDisplay
		})}`
		: "";
	const outcomeTranslationToLoad = packet.outcome === WitchActionOutcomeType.EFFECT
		? `smallEvents:witch.witchEventResults.outcomes.2.${packet.effectId}`
		: `smallEvents:witch.witchEventResults.outcomes.${packet.outcome + 1}`;
	await (interaction.isRepliable() ? interaction.followUp : interaction.editReply).bind(interaction)({
		embeds: [
			new CrowniclesSmallEventEmbed(
				"witch",
				`${StringUtils.getRandomTranslation(introToLoad, lng, {
					witchEvent: `${i18n.t(`smallEvents:witch.witchEventNames.${packet.ingredientId}`, { lng })} ${CrowniclesIcons.witchSmallEvent[packet.ingredientId]}`
						.toLowerCase()
				})} ${StringUtils.getRandomTranslation(outcomeTranslationToLoad, lng, { lifeLoss: packet.lifeLoss })}${timeOutro}`,
				interaction.user,
				lng
			)
		]
	});
}
