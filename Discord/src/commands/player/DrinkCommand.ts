import { ICommand } from "../ICommand";
import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import {
	CommandDrinkPacketReq, CommandDrinkPacketRes
} from "../../../../Lib/src/packets/commands/CommandDrinkPacket";
import { DiscordCache } from "../../bot/DiscordCache";
import i18n from "../../translations/i18n";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import {
	ReactionCollectorCreationPacket,
	ReactionCollectorRefuseReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { DisplayUtils } from "../../utils/DisplayUtils";
import { DiscordCollectorUtils } from "../../utils/DiscordCollectorUtils";
import {
	ReactionCollectorDrinkReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorDrink";
import { minutesDisplay } from "../../../../Lib/src/utils/TimeUtils";
import { ReactionCollectorReturnTypeOrNull } from "../../packetHandlers/handlers/ReactionCollectorHandlers";
import { escapeUsername } from "../../utils/StringUtils";
import {
	ActionRowBuilder, parseEmoji, StringSelectMenuBuilder,
	StringSelectMenuInteraction, StringSelectMenuOptionBuilder
} from "discord.js";
import { DiscordItemUtils } from "../../utils/DiscordItemUtils";
import { CrowniclesIcons } from "../../../../Lib/src/CrowniclesIcons";
import { sendInteractionNotForYou } from "../../utils/ErrorUtils";
import { MessagesUtils } from "../../utils/MessagesUtils";
import {
	ItemConstants,
	ItemNature
} from "../../../../Lib/src/constants/ItemConstants";

/**
 * Get the daily bonus packet to send to the server
 * @param interaction
 */
async function getPacket(interaction: CrowniclesInteraction): Promise<CommandDrinkPacketReq> {
	await interaction.deferReply();
	return makePacket(CommandDrinkPacketReq, {});
}

export async function drinkAcceptCollector(context: PacketContext, packet: ReactionCollectorCreationPacket): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
	if (!interaction) {
		return null;
	}
	const lng = interaction.userLanguage;

	const potions = packet.reactions.filter(r => r.type === ReactionCollectorDrinkReaction.name).map(r => r.data as ReactionCollectorDrinkReaction);
	const refuseReactionIndex = packet.reactions.findIndex(r => r.type === ReactionCollectorRefuseReaction.name);

	if (potions.length === 1) {
		const embed = new CrowniclesEmbed()
			.formatAuthor(
				i18n.t("commands:drink.collectorTitleOneObject", {
					pseudo: escapeUsername(interaction.user.displayName),
					lng
				}),
				interaction.user
			)
			.setDescription(i18n.t("commands:drink.collectorDescOneObject", {
				lng,
				object: DisplayUtils.getItemDisplayWithStats(potions[0].potion, lng)
			}));

		return await DiscordCollectorUtils.createAcceptRefuseCollector(interaction, embed, packet, context, {
			indexes: {
				accept: packet.reactions.findIndex(r => r.type !== ReactionCollectorRefuseReaction.name),
				refuse: refuseReactionIndex
			}
		});
	}

	const embed = new CrowniclesEmbed()
		.formatAuthor(
			i18n.t("commands:drink.collectorTitle", {
				pseudo: escapeUsername(interaction.user.displayName),
				lng
			}),
			interaction.user
		)
		.setDescription(i18n.t("commands:drink.collectorDesc", { lng }));

	const stringSelectMenu = new StringSelectMenuBuilder()
		.setCustomId("drinkSelectionMenu")
		.setPlaceholder(i18n.t("commands:drink.menuPlaceholder", { lng }))
		.addOptions([
			...potions.map((reaction, i) => new StringSelectMenuOptionBuilder()
				.setEmoji(DisplayUtils.getItemIcon({
					id: reaction.potion.id,
					category: reaction.potion.category
				}))
				.setLabel(DisplayUtils.getSimpleItemName(reaction.potion, lng))
				.setValue(i.toString(10))
				.setDescription(DiscordItemUtils.getPotionNatureDisplay(
					reaction.potion.detailsSupportItem!.nature,
					reaction.potion.detailsSupportItem!.power,
					lng
				))),
			new StringSelectMenuOptionBuilder()
				.setEmoji(parseEmoji(CrowniclesIcons.collectors.refuse)!)
				.setLabel(i18n.t("commands:drink.collectorRefuseOption", { lng }))
				.setValue(refuseReactionIndex.toString(10))
		]);

	const row = new ActionRowBuilder<StringSelectMenuBuilder>()
		.addComponents(stringSelectMenu);

	const msg = (await interaction.editReply({
		embeds: [embed],
		components: [row]
	}))!;

	const selectCollector = msg.createMessageComponentCollector({
		time: packet.endTime - Date.now()
	});

	selectCollector.on("collect", async (selectMenuInteraction: StringSelectMenuInteraction) => {
		if (selectMenuInteraction.user.id !== context.discord?.user) {
			await sendInteractionNotForYou(selectMenuInteraction.user, selectMenuInteraction, lng);
			return;
		}

		await selectMenuInteraction.deferReply();

		const selectedOption = selectMenuInteraction.values[0];

		DiscordCollectorUtils.sendReaction(
			packet,
			context,
			context.keycloakId!,
			selectMenuInteraction,
			parseInt(selectedOption, 10)
		);
	});

	selectCollector.on("end", async () => {
		row.components.forEach(component => {
			component.setDisabled(true);
		});

		await msg.edit({ components: [row] });
	});

	return [selectCollector];
}

export async function handleDrinkConsumePotion(context: PacketContext, packet: CommandDrinkPacketRes): Promise<void> {
	const interaction = MessagesUtils.getCurrentInteraction(context);
	if (!interaction) {
		return;
	}
	const lng = context.discord!.language;

	const keyDesc = packet.value === ItemNature.NONE ? "descriptionNoBonus" : "description";
	await interaction.editReply({
		embeds: [
			new CrowniclesEmbed()
				.formatAuthor(i18n.t("commands:drink.title", {
					pseudo: escapeUsername(interaction.user.displayName),
					lng
				}), interaction.user)
				.setDescription(
					i18n.t(`commands:drink.${keyDesc}`, {
						value: packet.itemNature === ItemNature.TIME_SPEEDUP ? minutesDisplay(packet.value, lng) : packet.value,
						nature: ItemConstants.NATURE_ID_TO_NAME[packet.itemNature],
						lng
					})
				)
		]
	});
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("drink"),
	getPacket,
	mainGuildCommand: false
};
