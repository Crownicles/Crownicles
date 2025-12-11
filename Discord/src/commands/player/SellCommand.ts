import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { ICommand } from "../ICommand";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import { DiscordCache } from "../../bot/DiscordCache";
import i18n from "../../translations/i18n";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import {
	CommandSellItemSuccessPacket,
	CommandSellPacketReq
} from "../../../../Lib/src/packets/commands/CommandSellPacket";
import { ItemCategory } from "../../../../Lib/src/constants/ItemConstants";
import { DisplayUtils } from "../../utils/DisplayUtils";
import { ReactionCollectorRefuseReaction } from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { ReactionCollectorReturnTypeOrNull } from "../../packetHandlers/handlers/ReactionCollectorHandlers";
import {
	ReactionCollectorSellItemReaction,
	ReactionCollectorSellPacket
} from "../../../../Lib/src/packets/interaction/ReactionCollectorSell";
import { CrowniclesIcons } from "../../../../Lib/src/CrowniclesIcons";
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonInteraction,
	ButtonStyle,
	InteractionCollector,
	Message,
	parseEmoji,
	StringSelectMenuBuilder,
	StringSelectMenuInteraction,
	StringSelectMenuOptionBuilder
} from "discord.js";
import { sendInteractionNotForYou } from "../../utils/ErrorUtils";
import {
	DiscordCollectorUtils,
	disableRows
} from "../../utils/DiscordCollectorUtils";
import { PacketUtils } from "../../utils/PacketUtils";
import { ReactionCollectorResetTimerPacketReq } from "../../../../Lib/src/packets/interaction/ReactionCollectorResetTimer";
import { escapeUsername } from "../../utils/StringUtils";

/**
 * Get the packet
 */
async function getPacket(interaction: CrowniclesInteraction): Promise<CommandSellPacketReq> {
	await interaction.deferReply();
	return makePacket(CommandSellPacketReq, {});
}

export async function handleCommandSellSuccessPacket(packet: CommandSellItemSuccessPacket, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!);

	if (!interaction) {
		return;
	}

	const lng = context.discord!.language;
	const title = i18n.t("commands:sell.soldMessageTitle", {
		lng,
		pseudo: escapeUsername(interaction.user.displayName)
	});
	const description = i18n.t(
		packet.item.category === ItemCategory.POTION && packet.price === 0
			? "commands:sell.potionDestroyedMessage"
			: "commands:sell.soldMessage",
		{
			lng,
			item: DisplayUtils.getItemDisplay(packet.item, lng),
			value: packet.price
		}
	);

	await interaction.editReply({
		embeds: [
			new CrowniclesEmbed()
				.formatAuthor(title, interaction.user)
				.setDescription(description)
		]
	});
}

async function validateSell(
	packet: ReactionCollectorSellPacket,
	context: PacketContext,
	interaction: CrowniclesInteraction | StringSelectMenuInteraction,
	reactionsInfo: {
		reaction: ReactionCollectorSellItemReaction; reactionIndex: number; refuseReactionIndex: number;
	}
): Promise<ReactionCollectorReturnTypeOrNull> {
	const lng = context.discord!.language;
	const validateClassChangeEmbed = new CrowniclesEmbed()
		.formatAuthor(i18n.t("commands:sell.sellTitle", {
			lng,
			pseudo: escapeUsername(interaction.user.displayName)
		}), interaction.user)
		.setDescription(i18n.t(reactionsInfo.reaction.item.category === ItemCategory.POTION && reactionsInfo.reaction.price === 0 ? "commands:sell.confirmThrowAway" : "commands:sell.confirmSell", {
			lng,
			item: DisplayUtils.getItemDisplay(reactionsInfo.reaction.item, lng),
			value: reactionsInfo.reaction.price
		}));

	const refuseCustomId = "refuse";
	const acceptCustomId = "validate";

	const validateRow = new ActionRowBuilder<ButtonBuilder>()
		.addComponents(new ButtonBuilder()
			.setEmoji(parseEmoji(CrowniclesIcons.collectors.accept)!)
			.setCustomId(acceptCustomId)
			.setStyle(ButtonStyle.Secondary))
		.addComponents(new ButtonBuilder()
			.setEmoji(parseEmoji(CrowniclesIcons.collectors.refuse)!)
			.setCustomId(refuseCustomId)
			.setStyle(ButtonStyle.Secondary));

	const validateMsg = await interaction.editReply({
		embeds: [validateClassChangeEmbed],
		components: [validateRow]
	}) as Message;

	const validateCollector = validateMsg.createMessageComponentCollector();

	validateCollector.on("collect", async (validateInteraction: ButtonInteraction) => {
		if (validateInteraction.user.id !== context.discord?.user) {
			await sendInteractionNotForYou(validateInteraction.user, validateInteraction, lng);
			return;
		}

		await validateInteraction.deferReply();

		if (validateInteraction.customId === refuseCustomId) {
			DiscordCollectorUtils.sendReaction(
				packet,
				context,
				context.keycloakId!,
				validateInteraction,
				reactionsInfo.refuseReactionIndex
			);
			return;
		}

		DiscordCollectorUtils.sendReaction(
			packet,
			context,
			context.keycloakId!,
			validateInteraction,
			reactionsInfo.reactionIndex
		);
	});

	validateCollector.on("end", async () => {
		// Disable buttons instead of removing them
		disableRows([validateRow]);

		await validateMsg.edit({
			components: [validateRow]
		});
	});

	return [validateCollector];
}

export async function handleSellReactionCollector(context: PacketContext, packet: ReactionCollectorSellPacket): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);

	if (!interaction) {
		return null;
	}
	const lng = interaction.userLanguage;

	const itemsReactions = packet.reactions.filter(reaction => reaction.type === ReactionCollectorSellItemReaction.name)
		.map(reaction => reaction.data) as ReactionCollectorSellItemReaction[];
	const refuseReactionIndex = packet.reactions.findIndex(reaction => reaction.type === ReactionCollectorRefuseReaction.name);

	if (itemsReactions.length === 1) {
		return await validateSell(
			packet,
			context,
			interaction,
			{
				reaction: itemsReactions[0],
				reactionIndex: packet.reactions.findIndex(reaction => reaction.type === ReactionCollectorSellItemReaction.name),
				refuseReactionIndex
			}
		);
	}

	const mainEmbed = new CrowniclesEmbed()
		.formatAuthor(i18n.t("commands:sell.titleChoiceEmbed", {
			lng,
			pseudo: escapeUsername(interaction.user.displayName)
		}), interaction.user)
		.setDescription(i18n.t("commands:sell.sellIndication", { lng }));

	const refuseCustomId = "refuse";

	const mainEmbedRow = new ActionRowBuilder<StringSelectMenuBuilder>();
	const selectMenu = new StringSelectMenuBuilder()
		.setCustomId("sellSelectionMenu")
		.setPlaceholder(i18n.t("commands:sell.menuPlaceholder", { lng }));
	for (let i = 0; i < itemsReactions.length; i++) {
		const reaction = itemsReactions[i];
		selectMenu.addOptions(new StringSelectMenuOptionBuilder()
			.setLabel(DisplayUtils.getSimpleItemName(reaction.item, lng))
			.setValue(i.toString())
			.setDescription(
				i18n.t(
					reaction.item.category === ItemCategory.POTION && reaction.price === 0 ? "commands:sell.selectMenuDescThrow" : "commands:sell.selectMenuDescSell",
					{
						lng,
						value: reaction.price
					}
				)
			)
			.setEmoji(parseEmoji(DisplayUtils.getItemIcon(reaction.item))!));
	}

	selectMenu.addOptions(new StringSelectMenuOptionBuilder()
		.setLabel(i18n.t("commands:sell.cancel", { lng }))
		.setValue(refuseCustomId)
		.setEmoji(parseEmoji(CrowniclesIcons.collectors.refuse)!));

	mainEmbedRow.addComponents(selectMenu);

	const msg = (await interaction.editReply({
		embeds: [mainEmbed],
		components: [mainEmbedRow]
	}))!;

	let validateCollector: InteractionCollector<never>;

	const selectCollector = msg.createMessageComponentCollector({
		time: packet.endTime - Date.now()
	});

	selectCollector.on("collect", async (selectMenuInteraction: StringSelectMenuInteraction) => {
		if (selectMenuInteraction.user.id !== context.discord?.user) {
			await sendInteractionNotForYou(selectMenuInteraction.user, selectMenuInteraction, lng);
			return;
		}

		await selectMenuInteraction.deferReply();

		mainEmbedRow.components.forEach(component => {
			component.setDisabled(true);
		});

		await msg.edit({
			embeds: [mainEmbed],
			components: [mainEmbedRow]
		});

		const selectedOption = selectMenuInteraction.values[0];

		if (selectedOption === refuseCustomId) {
			DiscordCollectorUtils.sendReaction(
				packet,
				context,
				context.keycloakId!,
				selectMenuInteraction,
				packet.reactions.findIndex(reaction => reaction.type === ReactionCollectorRefuseReaction.name)
			);
			return;
		}

		// Reset the collector timer, so it doesn't end while the user is still choosing either to validate or refuse
		PacketUtils.sendPacketToBackend(context, makePacket(ReactionCollectorResetTimerPacketReq, { reactionCollectorId: packet.id }));

		const reaction = itemsReactions[parseInt(selectedOption, 10)];

		validateCollector = (
			await validateSell(
				packet,
				context,
				selectMenuInteraction,
				{
					reaction,
					reactionIndex: packet.reactions.findIndex(packetReaction => JSON.stringify(packetReaction.data) === JSON.stringify(reaction)),
					refuseReactionIndex
				}
			))![0] as unknown as InteractionCollector<never>;
	});

	selectCollector.on("end", async () => {
		mainEmbedRow.components.forEach(component => {
			component.setDisabled(true);
		});

		await msg.edit({
			components: [mainEmbedRow]
		});
		if (validateCollector && !validateCollector.ended) {
			validateCollector.stop();
		}
	});

	return [selectCollector];
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("sell"),
	getPacket,
	mainGuildCommand: false
};
