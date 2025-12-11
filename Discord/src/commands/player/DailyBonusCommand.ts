import { ICommand } from "../ICommand";
import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import {
	CommandDailyBonusPacketReq,
	CommandDailyBonusPacketRes
} from "../../../../Lib/src/packets/commands/CommandDailyBonusPacket";
import { DiscordCache } from "../../bot/DiscordCache";
import { CrowniclesErrorEmbed } from "../../messages/CrowniclesErrorEmbed";
import i18n from "../../translations/i18n";
import {
	hoursToMilliseconds, minutesDisplay, printTimeBeforeDate
} from "../../../../Lib/src/utils/TimeUtils";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import {
	ItemConstants, ItemNature
} from "../../../../Lib/src/constants/ItemConstants";
import { escapeUsername } from "../../utils/StringUtils";
import { ReactionCollectorRefuseReaction } from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { ReactionCollectorReturnTypeOrNull } from "../../packetHandlers/handlers/ReactionCollectorHandlers";
import {
	ReactionCollectorDailyBonusPacket,
	ReactionCollectorDailyBonusReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorDailyBonus";
import { DisplayUtils } from "../../utils/DisplayUtils";
import { DiscordCollectorUtils } from "../../utils/DiscordCollectorUtils";
import {
	ActionRowBuilder,
	parseEmoji,
	StringSelectMenuBuilder,
	StringSelectMenuInteraction,
	StringSelectMenuOptionBuilder
} from "discord.js";
import { DiscordItemUtils } from "../../utils/DiscordItemUtils";
import { CrowniclesIcons } from "../../../../Lib/src/CrowniclesIcons";
import { sendInteractionNotForYou } from "../../utils/ErrorUtils";
import { MessagesUtils } from "../../utils/MessagesUtils";

/**
 * Get the daily bonus packet to send to the server
 * @param interaction
 */
async function getPacket(interaction: CrowniclesInteraction): Promise<CommandDailyBonusPacketReq> {
	await interaction.deferReply();
	return makePacket(CommandDailyBonusPacketReq, {});
}

/**
 * Handle daily bonus cooldown error
 * @param context
 * @param lastDailyTimestamp
 * @param cooldownTime
 */
export async function handleDailyBonusCooldownError(context: PacketContext, lastDailyTimestamp: number, cooldownTime: number): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);
	await interaction?.editReply({
		embeds: [
			new CrowniclesErrorEmbed(
				interaction.user,
				context,
				interaction,
				i18n.t("commands:daily.errors.cooldown", {
					cooldownTime,
					time: printTimeBeforeDate(lastDailyTimestamp + hoursToMilliseconds(cooldownTime)),
					lng: interaction.userLanguage
				})
			)
		]
	});
}

/**
 * Handle daily bonus success
 * @param context
 * @param packet
 */
export async function handleDailyBonusRes(context: PacketContext, packet: CommandDailyBonusPacketRes): Promise<void> {
	const interaction = MessagesUtils.getCurrentInteraction(context);
	if (!interaction) {
		return;
	}
	const lng = context.discord!.language;

	await interaction.editReply({
		embeds: [
			new CrowniclesEmbed()
				.formatAuthor(i18n.t("commands:daily.title", {
					pseudo: escapeUsername(interaction.user.displayName),
					lng
				}), interaction.user)
				.setDescription(
					i18n.t("commands:daily.description", {
						value: packet.itemNature === ItemNature.TIME_SPEEDUP ? minutesDisplay(packet.value, lng) : packet.value,
						nature: ItemConstants.NATURE_ID_TO_NAME[packet.itemNature],
						lng
					})
				)
		]
	});
}

export async function handleDailyBonusCollector(context: PacketContext, packet: ReactionCollectorDailyBonusPacket): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
	if (!interaction) {
		return null;
	}
	const lng = interaction.userLanguage;

	const objects = packet.reactions
		.filter((r): r is {
			type: string; data: ReactionCollectorDailyBonusReaction;
		} => r.type === ReactionCollectorDailyBonusReaction.name)
		.map(r => r.data);
	const refuseReactionIndex = packet.reactions.findIndex(r => r.type === ReactionCollectorRefuseReaction.name);

	if (objects.length === 1) {
		const embed = new CrowniclesEmbed()
			.formatAuthor(
				i18n.t("commands:daily.collectorTitleOneObject", {
					pseudo: escapeUsername(interaction.user.displayName),
					lng
				}),
				interaction.user
			)
			.setDescription(i18n.t("commands:daily.collectorDescOneObject", {
				lng,
				object: DisplayUtils.getItemDisplayWithStats(objects[0].object, lng)
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
			i18n.t("commands:daily.collectorTitle", {
				pseudo: escapeUsername(interaction.user.displayName),
				lng
			}),
			interaction.user
		)
		.setDescription(i18n.t("commands:daily.collectorDesc", { lng }));

	const stringSelectMenu = new StringSelectMenuBuilder()
		.setCustomId("dailySelectionMenu")
		.setPlaceholder(i18n.t("commands:daily.menuPlaceholder", { lng }))
		.addOptions([
			...objects.map((reaction, i) => new StringSelectMenuOptionBuilder()
				.setEmoji(DisplayUtils.getItemIcon({
					id: reaction.object.id,
					category: reaction.object.category
				}))
				.setLabel(DisplayUtils.getSimpleItemName(reaction.object, lng))
				.setValue(i.toString(10))
				.setDescription(DiscordItemUtils.getObjectNatureDisplay(
					reaction.object.detailsSupportItem!.nature,
					reaction.object.detailsSupportItem!.power,
					reaction.object.detailsSupportItem!.power, lng
				))),
			new StringSelectMenuOptionBuilder()
				.setEmoji(parseEmoji(CrowniclesIcons.collectors.refuse)!)
				.setLabel(i18n.t("commands:daily.collectorRefuseOption", { lng }))
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

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("daily"),
	getPacket,
	mainGuildCommand: false
};
