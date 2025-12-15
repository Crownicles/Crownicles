import { PacketContext } from "../../../Lib/src/packets/CrowniclesPacket";
import { ReactionCollectorCreationPacket } from "../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import {
	ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, parseEmoji
} from "discord.js";
import { DiscordCache } from "../bot/DiscordCache";
import { CrowniclesIcons } from "../../../Lib/src/CrowniclesIcons";
import {
	DiscordCollectorUtils, disableRows
} from "./DiscordCollectorUtils";
import { sendInteractionNotForYou } from "./ErrorUtils";
import { CrowniclesEmbed } from "../messages/CrowniclesEmbed";
import { ReactionCollectorReturnTypeOrNull } from "../packetHandlers/handlers/ReactionCollectorHandlers";
import { Language } from "../../../Lib/src/Language";
import i18n from "../translations/i18n";
import { escapeUsername } from "./StringUtils";

/**
 * Configuration for a confirmation collector
 */
interface ConfirmationCollectorConfig {
	titleKey: string;
	descriptionKey: string;
	descriptionParams: Record<string, unknown>;
}

/**
 * Creates a standard accept/refuse confirmation collector with an embed
 * This function reduces code duplication between buyHeal and useTokens collectors
 */
export async function createConfirmationCollector(
	context: PacketContext,
	packet: ReactionCollectorCreationPacket,
	config: ConfirmationCollectorConfig
): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
	const lng = interaction.userLanguage;

	const embed = buildConfirmationEmbed(interaction, lng, config);
	const row = buildAcceptRefuseButtons();

	const msg = await interaction.followUp({
		embeds: [embed],
		components: [row]
	});

	if (!msg) {
		return null;
	}

	return setupButtonCollector(msg, row, embed, packet, context, lng);
}

/**
 * Build the confirmation embed
 */
function buildConfirmationEmbed(
	interaction: ReturnType<typeof DiscordCache.getInteraction>,
	lng: Language,
	config: ConfirmationCollectorConfig
): CrowniclesEmbed {
	return new CrowniclesEmbed()
		.formatAuthor(i18n.t(config.titleKey, {
			lng,
			pseudo: escapeUsername(interaction!.user.displayName)
		}), interaction!.user)
		.setDescription(i18n.t(config.descriptionKey, {
			lng,
			...config.descriptionParams
		}));
}

/**
 * Build the accept/refuse buttons row
 */
function buildAcceptRefuseButtons(): ActionRowBuilder<ButtonBuilder> {
	const row = new ActionRowBuilder<ButtonBuilder>();

	const acceptButton = new ButtonBuilder()
		.setEmoji(parseEmoji(CrowniclesIcons.collectors.accept)!)
		.setCustomId("accept")
		.setStyle(ButtonStyle.Secondary);

	const refuseButton = new ButtonBuilder()
		.setEmoji(parseEmoji(CrowniclesIcons.collectors.refuse)!)
		.setCustomId("refuse")
		.setStyle(ButtonStyle.Secondary);

	row.addComponents(acceptButton, refuseButton);
	return row;
}

/**
 * Setup the button collector with handlers
 */
function setupButtonCollector(
	msg: Awaited<ReturnType<NonNullable<ReturnType<typeof DiscordCache.getInteraction>>["followUp"]>>,
	row: ActionRowBuilder<ButtonBuilder>,
	embed: CrowniclesEmbed,
	packet: ReactionCollectorCreationPacket,
	context: PacketContext,
	lng: Language
): ReactionCollectorReturnTypeOrNull {
	const buttonCollector = msg!.createMessageComponentCollector({
		time: packet.endTime - Date.now()
	});

	buttonCollector.on("collect", async (buttonInteraction: ButtonInteraction) => {
		if (buttonInteraction.user.id !== context.discord?.user) {
			await sendInteractionNotForYou(buttonInteraction.user, buttonInteraction, lng);
			return;
		}

		disableRows([row]);
		await msg!.edit({
			embeds: [embed],
			components: [row]
		});

		await buttonInteraction.deferReply();

		const reactionIndex = buttonInteraction.customId === "accept" ? 0 : 1;
		DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, buttonInteraction, reactionIndex);
		// Note: Do not call buttonCollector.stop() here - Core will send ReactionCollectorStopPacket to stop the collector
	});

	buttonCollector.on("end", async () => {
		disableRows([row]);
		await msg!.edit({
			embeds: [embed],
			components: [row]
		}).catch(() => null);
	});

	return [buttonCollector];
}
