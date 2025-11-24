import { PacketContext } from "../../../Lib/src/packets/CrowniclesPacket";
import { ReactionCollectorCreationPacket } from "../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import {
	ReactionCollectorPetFoodSmallEventData, ReactionCollectorPetFoodInvestigateReaction, ReactionCollectorPetFoodSendPetReaction, ReactionCollectorPetFoodContinueReaction
} from "../../../Lib/src/packets/interaction/ReactionCollectorPetFoodSmallEvent";
import { DiscordCache } from "../bot/DiscordCache";
import { CrowniclesSmallEventEmbed } from "../messages/CrowniclesSmallEventEmbed";
import i18n from "../translations/i18n";
import { CrowniclesIcons } from "../../../Lib/src/CrowniclesIcons";
import {
	ActionRowBuilder, ButtonBuilder, ButtonStyle, parseEmoji
} from "discord.js";
import { ReactionCollectorReturnTypeOrNull } from "../packetHandlers/handlers/ReactionCollectorHandlers";
import { DiscordCollectorUtils } from "../utils/DiscordCollectorUtils";
import { KeycloakUtils } from "../../../Lib/src/keycloak/KeycloakUtils";
import { keycloakConfig } from "../bot/CrowniclesShard";
import { sendInteractionNotForYou } from "../utils/ErrorUtils";
import { SmallEventPetFoodPacket } from "../../../Lib/src/packets/smallEvents/SmallEventPetFoodPacket";
import { Language } from "../../../Lib/src/Language";
import { RandomUtils } from "../../../Lib/src/utils/RandomUtils";

/**
 * Handle the pet food small event collector interaction
 * @param context - Packet context containing Discord interaction info
 * @param packet - Reaction collector creation packet with event data
 * @returns The collector instance or null if creation failed
 */
export async function petFoodCollector(context: PacketContext, packet: ReactionCollectorCreationPacket): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
	const data = packet.data.data as ReactionCollectorPetFoodSmallEventData;
	const lng = interaction!.userLanguage;

	const embed = new CrowniclesSmallEventEmbed(
		"petFood",
		`${i18n.t(`smallEvents:petFood.intro.${data.foodType}`, { lng })}\n\n${CrowniclesIcons.collectors.question} ${i18n.t("smallEvents:petFood.choices.investigate", { lng })}\n${CrowniclesIcons.smallEvents.pet} ${i18n.t("smallEvents:petFood.choices.sendPet", { lng })}\n${CrowniclesIcons.smallEvents.doNothing} ${i18n.t("smallEvents:petFood.choices.continue", { lng })}`,
		interaction.user,
		lng
	);

	const row = new ActionRowBuilder<ButtonBuilder>();

	row.addComponents(
		new ButtonBuilder()
			.setCustomId("investigate")
			.setEmoji(parseEmoji(CrowniclesIcons.collectors.question)!)
			.setStyle(ButtonStyle.Secondary),
		new ButtonBuilder()
			.setCustomId("pet")
			.setEmoji(parseEmoji(CrowniclesIcons.smallEvents.pet)!)
			.setStyle(ButtonStyle.Secondary),
		new ButtonBuilder()
			.setCustomId("continue")
			.setEmoji(parseEmoji(CrowniclesIcons.smallEvents.doNothing)!)
			.setStyle(ButtonStyle.Secondary)
	);

	const msg = await interaction.editReply({
		embeds: [embed],
		components: [row]
	});

	if (!msg) {
		return null;
	}

	const collector = msg.createMessageComponentCollector({
		time: packet.endTime - Date.now()
	});

	collector.on("collect", async buttonInteraction => {
		if (buttonInteraction.user.id !== interaction.user.id) {
			await sendInteractionNotForYou(buttonInteraction.user, buttonInteraction, lng);
			return;
		}

		const getReactingPlayer = await KeycloakUtils.getKeycloakIdFromDiscordId(keycloakConfig, buttonInteraction.user.id, buttonInteraction.user.displayName);
		if (!getReactingPlayer.isError && getReactingPlayer.payload.keycloakId) {
			await buttonInteraction.deferReply();

			// Disable buttons
			row.components.forEach(c => c.setDisabled(true));
			await msg.edit({ components: [row] });

			let reactionIndex = -1;
			if (buttonInteraction.customId === "investigate") {
				reactionIndex = packet.reactions.findIndex(r => r.type === ReactionCollectorPetFoodInvestigateReaction.name);
			}
			else if (buttonInteraction.customId === "pet") {
				reactionIndex = packet.reactions.findIndex(r => r.type === ReactionCollectorPetFoodSendPetReaction.name);
			}
			else if (buttonInteraction.customId === "continue") {
				reactionIndex = packet.reactions.findIndex(r => r.type === ReactionCollectorPetFoodContinueReaction.name);
			}

			if (reactionIndex !== -1) {
				DiscordCollectorUtils.sendReaction(packet, context, getReactingPlayer.payload.keycloakId, buttonInteraction, reactionIndex);
			}
			collector.stop();
		}
	});

	collector.on("end", async () => {
		row.components.forEach(c => c.setDisabled(true));
		await msg.edit({ components: [row] });
	});

	return [collector];
}

/**
 * Build the description text for pet food small event outcome
 * @param packet
 * @param lng
 */
export function getPetFoodDescription(packet: SmallEventPetFoodPacket, lng: Language): string {
	// Outcomes that mean some food was found (by player or pet, or simply found)
	const FOUND_OUTCOMES = new Set([
		"found_by_player",
		"found_by_pet",
		"found_anyway"
	]);

	// Outcomes that should use a specific "_soup" translation when the food is soup
	const SOUP_OUTCOMES = new Set([
		"found_by_player",
		"found_by_pet",
		"found_anyway",
		"pet_failed"
	]);

	const outcomeIsFound = FOUND_OUTCOMES.has(packet.outcome);

	// If the food was actually found, pick a readable display name for it from translations
	const foodName = outcomeIsFound
		? RandomUtils.crowniclesRandom.pick(
			i18n.t(`smallEvents:petFood.foodNames.${packet.foodType}`, {
				lng,
				returnObjects: true
			})
		)
		: "";

	// When the food type is soup, some outcomes use a different translation key (e.g. "found_by_player_soup")
	const outcomeKey = packet.foodType === "soup" && SOUP_OUTCOMES.has(packet.outcome)
		? `${packet.outcome}_soup`
		: packet.outcome;

	// Base outcome message (always present)
	const baseMessage = i18n.t(
		`smallEvents:petFood.outcomes.${outcomeKey}`,
		{
			lng,
			foodName
		}
	);

	// Some outcomes also include a pet-love change message appended on a newline
	if (!outcomeIsFound) {
		return baseMessage;
	}

	const loveKey = packet.loveChange > 0 ? "plus" : packet.loveChange < 0 ? "minus" : "neutral";
	const loveMessage = i18n.t(`smallEvents:petFood.love.${loveKey}`, { lng });

	return `${baseMessage}\n${loveMessage}`;
}
