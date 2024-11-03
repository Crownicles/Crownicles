import {ReactionCollectorCreationPacket} from "../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import {PacketContext} from "../../../Lib/src/packets/DraftBotPacket";
import {DiscordCache} from "../bot/DiscordCache";
import {DraftbotSmallEventEmbed} from "../messages/DraftbotSmallEventEmbed";
import i18n from "../translations/i18n";
import {DiscordCollectorUtils} from "../utils/DiscordCollectorUtils";
import {KeycloakUtils} from "../../../Lib/src/keycloak/KeycloakUtils";
import {keycloakConfig} from "../bot/DraftBotShard";
import {ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, Message, parseEmoji} from "discord.js";
import {DraftBotIcons} from "../../../Lib/src/DraftBotIcons";
import {sendInteractionNotForYou} from "../utils/ErrorUtils";
import {ReactionCollectorWitchReaction} from "../../../Lib/src/packets/interaction/ReactionCollectorWitch";
import {getRandomSmallEventIntro} from "../packetHandlers/handlers/SmallEventsHandler";
import {StringUtils} from "../utils/StringUtils";
import {SmallEventWitchResultPacket} from "../../../Lib/src/packets/smallEvents/SmallEventWitchPacket";
import {Effect} from "../../../Lib/src/enums/Effect";
import {WitchActionOutcomeType} from "../../../Lib/src/enums/WitchActionOutcomeType";
import {EmoteUtils} from "../utils/EmoteUtils";

export async function witchCollector(packet: ReactionCollectorCreationPacket, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
	const user = (await KeycloakUtils.getUserByKeycloakId(keycloakConfig, context.keycloakId!))!;

	let witchIngredients = "\n\n";
	const reactions: [string, string][] = [];
	for (const reaction of packet.reactions) {
		const ingredientId = (reaction.data as ReactionCollectorWitchReaction).id;
		const emoji = EmoteUtils.translateEmojiToDiscord(DraftBotIcons.witch_small_event[ingredientId]);
		witchIngredients += `${emoji} ${i18n.t(`smallEvents:witch.witchEventNames.${ingredientId}`, {lng: interaction.userLanguage})}\n`;
		reactions.push([ingredientId, emoji]);
	}

	const intro = getRandomSmallEventIntro(interaction.userLanguage);
	const embed = new DraftbotSmallEventEmbed(
		"witch",
		intro
		+ StringUtils.getRandomTranslation("smallEvents:witch.intro", interaction.userLanguage)
		+ StringUtils.getRandomTranslation("smallEvents:witch.description", interaction.userLanguage)
		+ StringUtils.getRandomTranslation("smallEvents:witch.situation", interaction.userLanguage)
		+ witchIngredients,
		interaction.user,
		interaction.userLanguage
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
	buttonCollector.on("collect", async (i: ButtonInteraction) => {
		if (i.user.id !== context.discord?.user) {
			await sendInteractionNotForYou(i.user, i, interaction.userLanguage);
			return;
		}

		buttonCollector.stop();
	});

	// Collector end
	buttonCollector.on("end", async (collected) => {
		const firstReaction = collected.first() as ButtonInteraction;
		await firstReaction.deferReply();

		if (firstReaction) {
			DiscordCollectorUtils.sendReaction(
				packet,
				context,
				user,
				firstReaction,
				packet.reactions.findIndex((reaction) => (reaction.data as ReactionCollectorWitchReaction).id === firstReaction.customId)
			);
		}
	});
}

export async function witchResult(packet: SmallEventWitchResultPacket, context: PacketContext): Promise<void> {
	const user = (await KeycloakUtils.getUserByKeycloakId(keycloakConfig, context.keycloakId!))!;
	const interaction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!);
	if (interaction) {
		const introToLoad = packet.isIngredient ? "smallEvents:witch.witchEventResults.ingredientIntros" : "smallEvents:witch.witchEventResults.adviceIntros";
		const timeOutro = packet.effectId === Effect.OCCUPIED.id && packet.timeLost > 0
			? StringUtils.getRandomTranslation("smallEvents:witch.witchEventResults.outcomes.2.time", user.attributes.language[0], {lostTime: packet.timeLost})
			: "";
		const outcomeTranslationToLoad = packet.forceEffect || packet.outcome === WitchActionOutcomeType.EFFECT ?
			`smallEvents:witch.witchEventResults.outcomes.2.${packet.effectId}` : `smallEvents:witch.witchEventResults.outcomes.${packet.outcome + 1}`;

		await interaction.editReply({
			embeds: [new DraftbotSmallEventEmbed(
				"witch",
				`${StringUtils.getRandomTranslation(introToLoad, user.attributes.language[0], {
					witchEvent: `${i18n.t(`smallEvents:witch.witchEventNames.${packet.ingredientId}`, {lng: user.attributes.language[0]})} ${DraftBotIcons.witch_small_event[packet.ingredientId]}`
						.toLowerCase()
				})} ${StringUtils.getRandomTranslation(outcomeTranslationToLoad, user.attributes.language[0], {lostLife: packet.lifeLoss})}${timeOutro}`,
				interaction.user,
				user.attributes.language[0]
			)]
		});
	}
}