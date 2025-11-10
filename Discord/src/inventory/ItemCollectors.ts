import { PacketContext } from "../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../bot/DiscordCache";
import {
	ReactionCollectorAcceptReaction,
	ReactionCollectorCreationPacket,
	ReactionCollectorRefuseReaction
} from "../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { CrowniclesEmbed } from "../messages/CrowniclesEmbed";
import {
	disableRows, DiscordCollectorUtils, SEND_POLITICS
} from "../utils/DiscordCollectorUtils";
import i18n from "../translations/i18n";
import { DisplayUtils } from "../utils/DisplayUtils";
import {
	ReactionCollectorItemChoiceDrinkPotionReaction,
	ReactionCollectorItemChoiceItemReaction,
	ReactionCollectorItemChoiceRefuseReaction
} from "../../../Lib/src/packets/interaction/ReactionCollectorItemChoice";
import {
	ReactionCollectorItemAcceptData,
	ReactionCollectorItemAcceptDrinkPotionReaction
} from "../../../Lib/src/packets/interaction/ReactionCollectorItemAccept";
import { ItemCategory } from "../../../Lib/src/constants/ItemConstants";
import { ReactionCollectorReturnTypeOrNull } from "../packetHandlers/handlers/ReactionCollectorHandlers";
import {
	ActionRowBuilder, ButtonBuilder, ButtonStyle, parseEmoji
} from "discord.js";
import { CrowniclesIcons } from "../../../Lib/src/CrowniclesIcons";
import { sendInteractionNotForYou } from "../utils/ErrorUtils";

export async function itemChoiceCollector(context: PacketContext, packet: ReactionCollectorCreationPacket): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
	const lng = interaction.userLanguage;
	const drinkReactionIndex = packet.reactions.findIndex(reaction => reaction.type === ReactionCollectorItemChoiceDrinkPotionReaction.name);

	const embed = new CrowniclesEmbed();
	embed.formatAuthor(i18n.t("commands:inventory.chooseItemToReplaceTitle", { lng }), interaction.user);

	if (drinkReactionIndex !== -1) {
		embed.setFooter({ text: i18n.t("commands:inventory.randomItemFooterPotionChoice", { lng }) });
	}

	return await DiscordCollectorUtils.createChoiceListCollector(interaction, {
		packet,
		context
	}, {
		embed,
		items: packet.reactions.filter(reaction => reaction.type === ReactionCollectorItemChoiceItemReaction.name)
			.map(reaction => {
				const itemReaction = reaction.data as ReactionCollectorItemChoiceItemReaction;
				return DisplayUtils.getItemDisplayWithStats(itemReaction.itemWithDetails, lng);
			})
	}, {
		refuse: {
			can: true,
			reactionIndex: packet.reactions.findIndex(reaction => reaction.type === ReactionCollectorItemChoiceRefuseReaction.name)
		},
		additionalButtons: drinkReactionIndex !== -1
			? [
				{
					button: new ButtonBuilder()
						.setEmoji(parseEmoji(CrowniclesIcons.items.drinkPotion)!)
						.setCustomId(drinkReactionIndex.toString(10))
						.setStyle(ButtonStyle.Secondary)
				}
			]
			: [],
		sendManners: SEND_POLITICS.ALWAYS_SEND
	});
}

export async function itemAcceptCollector(context: PacketContext, packet: ReactionCollectorCreationPacket): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
	const data = packet.data.data as ReactionCollectorItemAcceptData;
	const lng = interaction.userLanguage;
	const drinkReactionIndex = packet.reactions.findIndex(reaction => reaction.type === ReactionCollectorItemAcceptDrinkPotionReaction.name);

	const embed = new CrowniclesEmbed()
		.formatAuthor(
			data.itemWithDetails.category === ItemCategory.POTION
				? i18n.t("commands:inventory.randomItemAcceptTitlePotion", { lng })
				: i18n.t("commands:inventory.randomItemAcceptTitle", { lng }),
			interaction.user
		)
		.setDescription(DisplayUtils.getItemDisplayWithStats(data.itemWithDetails, lng));

	if (drinkReactionIndex !== -1) {
		embed.setFooter({ text: i18n.t("commands:inventory.randomItemFooterPotion", { lng }) });
	}

	const row = new ActionRowBuilder<ButtonBuilder>();

	row.addComponents(
		new ButtonBuilder()
			.setEmoji(parseEmoji(CrowniclesIcons.collectors.accept)!)
			.setCustomId(packet.reactions.findIndex(r => r.type === ReactionCollectorAcceptReaction.name).toString(10))
			.setStyle(ButtonStyle.Secondary)
	);

	if (drinkReactionIndex !== -1) {
		row.addComponents(
			new ButtonBuilder()
				.setEmoji(parseEmoji(CrowniclesIcons.items.drinkPotion)!)
				.setCustomId(drinkReactionIndex.toString(10))
				.setStyle(ButtonStyle.Secondary)
		);
	}

	row.addComponents(
		new ButtonBuilder()
			.setEmoji(parseEmoji(CrowniclesIcons.collectors.refuse)!)
			.setCustomId(packet.reactions.findIndex(r => r.type === ReactionCollectorRefuseReaction.name).toString(10))
			.setStyle(ButtonStyle.Secondary)
	);

	const msg = await interaction.channel.send({
		embeds: [embed], components: [row]
	});

	if (!msg) {
		return null;
	}

	const collector = msg.createMessageComponentCollector({ time: packet.endTime - Date.now() });

	collector.on("collect", async buttonInteraction => {
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
			parseInt(buttonInteraction.customId, 10)
		);
	});

	collector.on("end", async () => {
		disableRows([row]);

		await msg.edit({ components: [row] });
	});

	return [collector];
}
