import { PacketContext } from "../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../bot/DiscordCache";
import { CrowniclesSmallEventEmbed } from "../messages/CrowniclesSmallEventEmbed";
import i18n from "../translations/i18n";
import {
	disableRows, DiscordCollectorUtils
} from "../utils/DiscordCollectorUtils";
import {
	ReactionCollectorLotteryEasyReaction,
	ReactionCollectorLotteryHardReaction,
	ReactionCollectorLotteryMediumReaction,
	ReactionCollectorLotteryPacket
} from "../../../Lib/src/packets/interaction/ReactionCollectorLottery";
import {
	ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, Message, parseEmoji
} from "discord.js";
import { CrowniclesIcons } from "../../../Lib/src/CrowniclesIcons";
import { sendInteractionNotForYou } from "../utils/ErrorUtils";
import { ReactionCollectorReturnTypeOrNull } from "../packetHandlers/handlers/ReactionCollectorHandlers";

export async function lotteryCollector(context: PacketContext, packet: ReactionCollectorLotteryPacket): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
	const lng = interaction.userLanguage;

	const embed = new CrowniclesSmallEventEmbed(
		"lottery",
		i18n.t("smallEvents:lottery.intro", { lng }),
		interaction.user,
		lng
	);

	const row = new ActionRowBuilder<ButtonBuilder>();

	// Create buttons
	const easyButtonId = "easy";
	const easyButton = new ButtonBuilder()
		.setEmoji(parseEmoji(CrowniclesIcons.collectors.lottery.easy)!)
		.setCustomId(easyButtonId)
		.setStyle(ButtonStyle.Secondary);

	const mediumButtonId = "medium";
	const mediumButton = new ButtonBuilder()
		.setEmoji(parseEmoji(CrowniclesIcons.collectors.lottery.medium)!)
		.setCustomId(mediumButtonId)
		.setStyle(ButtonStyle.Secondary);

	const hardButtonId = "hard";
	const hardButton = new ButtonBuilder()
		.setEmoji(parseEmoji(CrowniclesIcons.collectors.lottery.hard)!)
		.setCustomId(hardButtonId)
		.setStyle(ButtonStyle.Secondary);

	row.addComponents(easyButton, mediumButton, hardButton);

	// Edit message
	const msg = await interaction?.editReply({
		embeds: [embed],
		components: [row]
	}) as Message;

	// Create button collector
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

		if (buttonInteraction.customId === easyButtonId) {
			DiscordCollectorUtils.sendReaction(
				packet,
				context,
				context.keycloakId!,
				buttonInteraction,
				packet.reactions.findIndex(reaction => reaction.type === ReactionCollectorLotteryEasyReaction.name)
			);
		}
		else if (buttonInteraction.customId === mediumButtonId) {
			DiscordCollectorUtils.sendReaction(
				packet,
				context,
				context.keycloakId!,
				buttonInteraction,
				packet.reactions.findIndex(reaction => reaction.type === ReactionCollectorLotteryMediumReaction.name)
			);
		}
		else if (buttonInteraction.customId === hardButtonId) {
			DiscordCollectorUtils.sendReaction(
				packet,
				context,
				context.keycloakId!,
				buttonInteraction,
				packet.reactions.findIndex(reaction => reaction.type === ReactionCollectorLotteryHardReaction.name)
			);
		}
	});

	buttonCollector.on("end", async () => {
		// Disable buttons instead of removing them
		disableRows([row]);

		await msg.edit({ components: [row] });
	});

	return [buttonCollector];
}
