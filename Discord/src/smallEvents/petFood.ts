import { PacketContext } from "../../../Lib/src/packets/CrowniclesPacket";
import {
	ReactionCollectorPetFoodSmallEventPacket, ReactionCollectorPetFoodInvestigateReaction, ReactionCollectorPetFoodSendPetReaction, ReactionCollectorPetFoodContinueReaction
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
import { SmallEventConstants } from "../../../Lib/src/constants/SmallEventConstants";
import { StringConstants } from "../../../Lib/src/constants/StringConstants";

/**
 * Handle the pet food small event collector interaction
 * @param context - Packet context containing Discord interaction info
 * @param packet - Reaction collector creation packet with event data
 * @returns The collector instance or null if creation failed
 */
export async function petFoodCollector(context: PacketContext, packet: ReactionCollectorPetFoodSmallEventPacket): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
	const data = packet.data.data;
	const lng = interaction!.userLanguage;

	// Get the sex context for gendered translations
	const sexContext = data.petSex === StringConstants.SEX.MALE.short
		? StringConstants.SEX.MALE.long
		: StringConstants.SEX.FEMALE.long;

	const embed = new CrowniclesSmallEventEmbed(
		SmallEventConstants.PET_FOOD.SMALL_EVENT_NAME,
		`${i18n.t(`smallEvents:petFood.intro.${data.foodType}`, {
			lng, context: sexContext
		})}\n\n${CrowniclesIcons.collectors.question} ${i18n.t("smallEvents:petFood.choices.investigate", { lng })}\n${CrowniclesIcons.smallEvents.pet} ${i18n.t("smallEvents:petFood.choices.sendPet", { lng })}\n${CrowniclesIcons.smallEvents.doNothing} ${i18n.t("smallEvents:petFood.choices.continue", { lng })}`,
		interaction.user,
		lng
	);

	const row = new ActionRowBuilder<ButtonBuilder>();

	row.addComponents(
		new ButtonBuilder()
			.setCustomId(SmallEventConstants.PET_FOOD.BUTTON_IDS.INVESTIGATE)
			.setEmoji(parseEmoji(CrowniclesIcons.collectors.question)!)
			.setStyle(ButtonStyle.Secondary),
		new ButtonBuilder()
			.setCustomId(SmallEventConstants.PET_FOOD.BUTTON_IDS.SEND_PET)
			.setEmoji(parseEmoji(CrowniclesIcons.smallEvents.pet)!)
			.setStyle(ButtonStyle.Secondary),
		new ButtonBuilder()
			.setCustomId(SmallEventConstants.PET_FOOD.BUTTON_IDS.CONTINUE)
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
			if (buttonInteraction.customId === SmallEventConstants.PET_FOOD.BUTTON_IDS.INVESTIGATE) {
				reactionIndex = packet.reactions.findIndex(r => r.type === ReactionCollectorPetFoodInvestigateReaction.name);
			}
			else if (buttonInteraction.customId === SmallEventConstants.PET_FOOD.BUTTON_IDS.SEND_PET) {
				reactionIndex = packet.reactions.findIndex(r => r.type === ReactionCollectorPetFoodSendPetReaction.name);
			}
			else if (buttonInteraction.customId === SmallEventConstants.PET_FOOD.BUTTON_IDS.CONTINUE) {
				reactionIndex = packet.reactions.findIndex(r => r.type === ReactionCollectorPetFoodContinueReaction.name);
			}

			if (reactionIndex !== -1) {
				DiscordCollectorUtils.sendReaction(packet, context, getReactingPlayer.payload.keycloakId, buttonInteraction, reactionIndex);
			}
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
	const FOUND_OUTCOMES = [
		SmallEventConstants.PET_FOOD.OUTCOMES.FOUND_BY_PLAYER,
		SmallEventConstants.PET_FOOD.OUTCOMES.FOUND_BY_PET,
		SmallEventConstants.PET_FOOD.OUTCOMES.FOUND_ANYWAY
	];

	// Outcomes that should use a specific "_soup" translation when the food is soup
	const SOUP_OUTCOMES = [
		SmallEventConstants.PET_FOOD.OUTCOMES.FOUND_BY_PLAYER,
		SmallEventConstants.PET_FOOD.OUTCOMES.FOUND_BY_PET,
		SmallEventConstants.PET_FOOD.OUTCOMES.FOUND_ANYWAY,
		SmallEventConstants.PET_FOOD.OUTCOMES.PET_FAILED
	];

	// Outcomes where the player investigated (loses time)
	const PLAYER_INVESTIGATED_OUTCOMES = [
		SmallEventConstants.PET_FOOD.OUTCOMES.FOUND_BY_PLAYER,
		SmallEventConstants.PET_FOOD.OUTCOMES.PLAYER_FAILED
	];

	const outcomeIsFound = FOUND_OUTCOMES.includes(packet.outcome);
	const playerInvestigated = PLAYER_INVESTIGATED_OUTCOMES.includes(packet.outcome);

	// Get the sex context for gendered translations
	const sexContext = packet.petSex === StringConstants.SEX.MALE.short
		? StringConstants.SEX.MALE.long
		: StringConstants.SEX.FEMALE.long;

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
	const outcomeKey = packet.foodType === SmallEventConstants.PET_FOOD.FOOD_TYPES.SOUP && SOUP_OUTCOMES.includes(packet.outcome)
		? `${packet.outcome}${SmallEventConstants.PET_FOOD.TRANSLATION_SUFFIX.SOUP}`
		: packet.outcome;

	// Calculate time display if player investigated
	const timeDisplay = playerInvestigated && packet.timeLost
		? i18n.formatDuration(packet.timeLost, lng)
		: "";

	// Base outcome message (always present) - pass time for outcomes where player investigated
	const baseMessage = i18n.t(
		`smallEvents:petFood.outcomes.${outcomeKey}`,
		{
			lng,
			context: sexContext,
			foodName,
			time: timeDisplay
		}
	);

	// Build the result message
	let result = baseMessage;

	// Some outcomes also include a pet-love change message appended on a newline
	if (outcomeIsFound) {
		const loveKey = packet.loveChange > 0
			? SmallEventConstants.PET_FOOD.LOVE_CHANGE_TYPES.PLUS
			: packet.loveChange < 0
				? SmallEventConstants.PET_FOOD.LOVE_CHANGE_TYPES.MINUS
				: SmallEventConstants.PET_FOOD.LOVE_CHANGE_TYPES.NEUTRAL;
		const loveMessage = i18n.t(`smallEvents:petFood.love.${loveKey}`, {
			lng,
			context: sexContext
		});
		result += `\n${loveMessage}`;
	}

	return result;
}
