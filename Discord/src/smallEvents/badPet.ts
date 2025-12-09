import { PacketContext } from "../../../Lib/src/packets/CrowniclesPacket";
import {
	ReactionCollectorBadPetSmallEventPacket
} from "../../../Lib/src/packets/interaction/ReactionCollectorBadPetSmallEvent";
import { DiscordCache } from "../bot/DiscordCache";
import { CrowniclesSmallEventEmbed } from "../messages/CrowniclesSmallEventEmbed";
import i18n from "../translations/i18n";
import { StringUtils } from "../utils/StringUtils";
import { PetUtils } from "../utils/PetUtils";
import { SexTypeShort } from "../../../Lib/src/constants/StringConstants";
import { CrowniclesIcons } from "../../../Lib/src/CrowniclesIcons";
import {
	ActionRowBuilder, ButtonBuilder, ButtonStyle, parseEmoji
} from "discord.js";
import { ReactionCollectorReturnTypeOrNull } from "../packetHandlers/handlers/ReactionCollectorHandlers";
import { DiscordCollectorUtils } from "../utils/DiscordCollectorUtils";
import { KeycloakUtils } from "../../../Lib/src/keycloak/KeycloakUtils";
import { keycloakConfig } from "../bot/CrowniclesShard";
import { sendInteractionNotForYou } from "../utils/ErrorUtils";
import { SmallEventConstants } from "../../../Lib/src/constants/SmallEventConstants";

/**
 * Valid action ID type derived from SmallEventConstants
 */
type BadPetActionId = typeof SmallEventConstants.BAD_PET.ACTION_IDS[keyof typeof SmallEventConstants.BAD_PET.ACTION_IDS];

/**
 * List of valid action IDs for the bad pet small event
 */
const VALID_ACTION_IDS: readonly BadPetActionId[] = Object.values(SmallEventConstants.BAD_PET.ACTION_IDS);

/**
 * Check if an action ID is valid
 */
function isValidActionId(id: string): id is BadPetActionId {
	return VALID_ACTION_IDS.includes(id as BadPetActionId);
}

export async function badPetCollector(context: PacketContext, packet: ReactionCollectorBadPetSmallEventPacket): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
	const lng = interaction.userLanguage;
	const data = packet.data.data;

	const petDisplay = PetUtils.petToShortString(lng, data.petNickname, data.petId, data.sex as SexTypeShort);

	let description = \`\${StringUtils.getRandomTranslation("smallEvents:badPet.intro", lng, { pet: petDisplay })}\n\n\`;

	const row = new ActionRowBuilder<ButtonBuilder>();

	for (const reaction of packet.reactions) {
		const reactionData = reaction.data;
		const actionId = reactionData.id;
		if (actionId && isValidActionId(actionId)) {
			const icon = CrowniclesIcons.badPetSmallEvent[actionId];

			description += \`\${icon} \${i18n.t(\`smallEvents:badPet.choices.\${actionId}\`, { lng })}\n\`;

			row.addComponents(
new ButtonBuilder()
					.setCustomId(actionId)
					.setEmoji(parseEmoji(icon) ?? icon)
					.setStyle(ButtonStyle.Secondary)
			);
		}
	}

	const embed = new CrowniclesSmallEventEmbed(
"badPet",
description,
interaction.user,
lng
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

			// Find the reaction index based on customId
			const reactionIndex = packet.reactions.findIndex(r => {
				const reactionData = r.data;
				return reactionData.id === buttonInteraction.customId;
			});

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
