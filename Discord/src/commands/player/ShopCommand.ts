import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { ICommand } from "../ICommand";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import { CommandShopPacketReq } from "../../../../Lib/src/packets/commands/CommandShopPacket";
import { DiscordCache } from "../../bot/DiscordCache";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import i18n from "../../translations/i18n";
import {
	sendErrorMessage, sendInteractionNotForYou, SendManner
} from "../../utils/ErrorUtils";
import { ReactionCollectorCreationPacket } from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import {
	CommandShopNotEnoughCurrency,
	ReactionCollectorShopCloseReaction,
	ReactionCollectorShopData,
	ReactionCollectorShopItemReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorShop";
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonInteraction,
	ButtonStyle,
	MessageComponentInteraction,
	parseEmoji,
	SelectMenuInteraction,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder
} from "discord.js";
import { DisplayUtils } from "../../utils/DisplayUtils";
import { Constants } from "../../../../Lib/src/constants/Constants";
import { PacketUtils } from "../../utils/PacketUtils";
import { ChangeBlockingReasonPacket } from "../../../../Lib/src/packets/utils/ChangeBlockingReasonPacket";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import { CrowniclesIcons } from "../../../../Lib/src/CrowniclesIcons";
import { Language } from "../../../../Lib/src/Language";
import {
	disableRows, DiscordCollectorUtils
} from "../../utils/DiscordCollectorUtils";
import {
	ReactionCollectorBuyCategorySlotCancelReaction,
	ReactionCollectorBuyCategorySlotReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorBuyCategorySlot";
import { ShopItemType } from "../../../../Lib/src/constants/LogsConstants";
import {
	shopItemTypeFromId, shopItemTypeToId
} from "../../../../Lib/src/utils/ShopUtils";
import { ReactionCollectorReturnTypeOrNull } from "../../packetHandlers/handlers/ReactionCollectorHandlers";
import { ReactionCollectorResetTimerPacketReq } from "../../../../Lib/src/packets/interaction/ReactionCollectorResetTimer";
import { escapeUsername } from "../../utils/StringUtils";
import { Badge } from "../../../../Lib/src/types/Badge";

function getPacket(): CommandShopPacketReq {
	return makePacket(CommandShopPacketReq, {});
}

export async function handleCommandShopNoAlterationToHeal(context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction!);

	if (interaction) {
		await sendErrorMessage(interaction.user, context, interaction, i18n.t("commands:shop.noAlterationToHeal", { lng: interaction.userLanguage }), { sendManner: SendManner.FOLLOWUP });
	}
}

export async function handleCommandShopAlreadyHaveBadge(context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction!);

	if (interaction) {
		await sendErrorMessage(interaction.user, context, interaction, i18n.t("commands:shop.alreadyHaveBadge", { lng: interaction.userLanguage }), { sendManner: SendManner.FOLLOWUP });
	}
}

export async function handleCommandShopBoughtTooMuchDailyPotions(context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction!);

	if (interaction) {
		await sendErrorMessage(interaction.user, context, interaction, i18n.t("commands:shop.boughtTooMuchDailyPotions", { lng: interaction.userLanguage }), { sendManner: SendManner.FOLLOWUP });
	}
}

export async function handleCommandShopNotEnoughMoney(packet: CommandShopNotEnoughCurrency, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction!);

	if (interaction) {
		await sendErrorMessage(interaction.user, context, interaction, i18n.t("commands:shop.notEnoughMoney", {
			lng: interaction.userLanguage,
			missingCurrency: packet.missingCurrency,
			currency: packet.currency
		}), { sendManner: SendManner.FOLLOWUP });
	}
}

export async function handleCommandShopHealAlterationDone(context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction!);
	if (!interaction) {
		return;
	}
	const lng = interaction.userLanguage;

	await interaction.followUp({
		embeds: [
			new CrowniclesEmbed()
				.formatAuthor(i18n.t("commands:shop.success", {
					lng,
					pseudo: escapeUsername(interaction.user.displayName)
				}), interaction.user)
				.setDescription(i18n.t("commands:shop.healAlteration", { lng }))
		]
	});
}

export async function handleCommandShopBadgeBought(context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction!);
	if (!interaction) {
		return;
	}
	const lng = interaction.userLanguage;

	await interaction.followUp({
		embeds: [
			new CrowniclesEmbed()
				.formatAuthor(i18n.t("commands:shop.success", {
					lng,
					pseudo: escapeUsername(interaction.user.displayName)
				}), interaction.user)
				.setDescription(i18n.t("commands:shop.badgeBought", {
					lng,
					badgeName: Badge.RICH
				}))
		]
	});
}

export async function shopInventoryExtensionCollector(context: PacketContext, packet: ReactionCollectorCreationPacket): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction!)!;
	const lng = interaction.userLanguage;
	const row = new ActionRowBuilder<ButtonBuilder>();
	let slotExtensionText = `${i18n.t("commands:shop.chooseSlotIndication", { lng })}\n\n`;
	for (const category of (packet.reactions.filter(reaction => reaction.type === ReactionCollectorBuyCategorySlotReaction.name)
		.map(r => r.data) as ReactionCollectorBuyCategorySlotReaction[])) {
		const button = new ButtonBuilder()
			.setCustomId(category.categoryId.toString(10))
			.setEmoji(parseEmoji(CrowniclesIcons.itemKinds[category.categoryId])!)
			.setStyle(ButtonStyle.Secondary);
		row.addComponents(button);
		slotExtensionText += i18n.t("commands:shop.shopCategoryFormat", {
			lng,
			category: i18n.t(`commands:shop.slotCategoriesKind.${category.categoryId.toString(10)}`, { lng }),
			count: category.remaining,
			limit: category.maxSlots,
			categoryId: category.categoryId
		});
	}
	const closeShopButton = new ButtonBuilder()
		.setCustomId("closeShop")
		.setLabel(i18n.t("commands:shop.closeShopButton", { lng }))
		.setStyle(ButtonStyle.Secondary);

	row.addComponents(closeShopButton);

	const msg = await interaction.followUp({
		embeds: [
			new CrowniclesEmbed()
				.formatAuthor(i18n.t("commands:shop.chooseSlotTitle", {
					lng,
					pseudo: escapeUsername(interaction.user.displayName)
				}), interaction.user)
				.setDescription(slotExtensionText)
		],
		components: [row]
	});

	if (!msg) {
		return null;
	}

	const buttonCollector = msg.createMessageComponentCollector({
		time: Constants.MESSAGES.COLLECTOR_TIME
	});

	buttonCollector.on("collect", async (buttonInteraction: ButtonInteraction) => {
		if (buttonInteraction.user.id !== context.discord?.user) {
			await sendInteractionNotForYou(buttonInteraction.user, buttonInteraction, lng);
			return;
		}

		// Disable buttons instead of removing them
		disableRows([row]);

		await buttonInteraction.update({ components: [row] });

		if (buttonInteraction.customId === "closeShop") {
			DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, null, packet.reactions.findIndex(r =>
				r.type === ReactionCollectorBuyCategorySlotCancelReaction.name));
			return;
		}

		DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, null, packet.reactions.findIndex(r =>
			r.type === ReactionCollectorBuyCategorySlotReaction.name
			&& (r.data as ReactionCollectorBuyCategorySlotReaction).categoryId === parseInt(buttonInteraction.customId, 10)));
	});

	buttonCollector.on("end", async () => {
		// Disable buttons instead of removing them
		disableRows([row]);

		await msg.edit({
			components: [row]
		});
	});

	return [buttonCollector];
}

export async function handleReactionCollectorBuyCategorySlotBuySuccess(context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction!);
	if (!interaction) {
		return;
	}
	const lng = interaction.userLanguage;
	await interaction.followUp({
		embeds: [
			new CrowniclesEmbed()
				.formatAuthor(i18n.t("commands:shop.success", {
					lng,
					pseudo: escapeUsername(interaction.user.displayName)
				}), interaction.user)
				.setDescription(i18n.t("commands:shop.buyCategorySlotSuccess", { lng }))
		]
	});
}

export async function handleCommandShopClosed(context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction!);
	if (!interaction) {
		return;
	}
	const lng = interaction.userLanguage;

	const args = {
		embeds: [
			new CrowniclesEmbed()
				.formatAuthor(i18n.t("commands:shop.closeShopTitle", {
					lng,
					pseudo: escapeUsername(interaction.user.displayName)
				}), interaction.user)
				.setDescription(i18n.t("commands:shop.closeShop", { lng }))
		]
	};
	await (interaction.replied ? interaction.followUp(args) : interaction.reply(args));
}

async function manageBuyoutConfirmation(packet: ReactionCollectorCreationPacket, context: PacketContext, data: ReactionCollectorShopData, reaction: ReactionCollectorShopItemReaction): Promise<void> {
	PacketUtils.sendPacketToBackend(context, makePacket(ChangeBlockingReasonPacket, {
		oldReason: BlockingConstants.REASONS.SHOP,
		newReason: BlockingConstants.REASONS.SHOP_CONFIRMATION
	}));
	PacketUtils.sendPacketToBackend(context, makePacket(ReactionCollectorResetTimerPacketReq, { reactionCollectorId: packet.id }));

	const interaction = DiscordCache.getInteraction(context.discord!.interaction!);
	if (!interaction) {
		return;
	}
	const lng = interaction.userLanguage;
	const shopItemId = reaction.shopItemId;

	const amounts = packet.reactions.filter(r => {
		const shopData = r.data as ReactionCollectorShopItemReaction;
		return r.type === ReactionCollectorShopItemReaction.name && shopData.shopItemId === reaction.shopItemId;
	})
		.map(r => (r.data as ReactionCollectorShopItemReaction).amount);

	const row = new ActionRowBuilder<ButtonBuilder>();

	if (amounts.length === 1 && amounts[0] === 1) {
		const buttonAccept = new ButtonBuilder()
			.setEmoji(parseEmoji(CrowniclesIcons.collectors.accept)!)
			.setCustomId("accept")
			.setStyle(ButtonStyle.Secondary);
		row.addComponents(buttonAccept);
	}
	else {
		for (const amount of amounts) {
			const buttonAccept = new ButtonBuilder()
				.setLabel(amount.toString(10))
				.setCustomId(amount.toString(10))
				.setStyle(ButtonStyle.Secondary);
			row.addComponents(buttonAccept);
		}
	}

	const buttonRefuse = new ButtonBuilder()
		.setEmoji(parseEmoji(CrowniclesIcons.collectors.refuse)!)
		.setCustomId("refuse")
		.setStyle(ButtonStyle.Secondary);
	row.addComponents(buttonRefuse);

	const shopItemNames = getShopItemNames(data, shopItemId, lng);

	const msg = await interaction.followUp({
		embeds: [
			new CrowniclesEmbed()
				.formatAuthor(i18n.t(amounts.length === 1 && amounts[0] === 1 ? "commands:shop.shopConfirmationTitle" : "commands:shop.shopConfirmationTitleMultiple", {
					lng,
					pseudo: escapeUsername(interaction.user.displayName)
				}), interaction.user)
				.setDescription(`${
					getShopItemDisplay(data, reaction, lng, shopItemNames, amounts)
				}\n${CrowniclesIcons.collectors.warning} ${
					i18n.t(`commands:shop.shopItems.${shopItemTypeToId(shopItemId)}.info`, {
						lng,
						kingsMoneyAmount: data.additionalShopData?.gemToMoneyRatio,
						thousandPoints: Constants.MISSION_SHOP.THOUSAND_POINTS
					})
				}`)
		],
		components: [row]
	});

	if (!msg) {
		return;
	}

	const buttonCollector = msg.createMessageComponentCollector({
		time: Constants.MESSAGES.COLLECTOR_TIME
	});

	buttonCollector.on("collect", async (buttonInteraction: ButtonInteraction) => {
		if (buttonInteraction.user.id !== context.discord?.user) {
			await sendInteractionNotForYou(buttonInteraction.user, buttonInteraction, lng);
			return;
		}

		// Disable buttons instead of removing them
		disableRows([row]);

		await buttonInteraction.update({ components: [row] });

		if (buttonInteraction.customId === "refuse") {
			DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, buttonInteraction, packet.reactions.findIndex(r =>
				r.type === ReactionCollectorShopCloseReaction.name));
			return;
		}

		DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, null, packet.reactions.findIndex(r =>
			r.type === ReactionCollectorShopItemReaction.name
			&& (r.data as ReactionCollectorShopItemReaction).shopItemId === reaction.shopItemId
			&& (amounts.length === 1 || (r.data as ReactionCollectorShopItemReaction).amount === parseInt(buttonInteraction!.customId, 10))));
	});

	buttonCollector.on("end", async () => {
		// Disable buttons instead of removing them
		disableRows([row]);

		await msg.edit({
			components: [row]
		});
	});
}

type ShopItemNames = {
	normal: string;
	short: string;
};

function getShopItemNames(data: ReactionCollectorShopData, shopItemId: ShopItemType, lng: Language): ShopItemNames {
	if (shopItemId === ShopItemType.DAILY_POTION) {
		return {
			normal: DisplayUtils.getItemDisplayWithStats(data.additionalShopData!.dailyPotion!, lng),
			short: DisplayUtils.getItemDisplay({
				id: data.additionalShopData!.dailyPotion!.id,
				category: data.additionalShopData!.dailyPotion!.category
			}, lng)
		};
	}
	const bothNames = i18n.t(`commands:shop.shopItems.${shopItemTypeToId(shopItemId)}.name`, {
		lng
	});
	return {
		normal: `**${bothNames}**`,
		short: bothNames
	};
}

function getShopItemDisplay(data: ReactionCollectorShopData, reaction: ReactionCollectorShopItemReaction, lng: Language, shopItemNames: ShopItemNames, amounts: number[]): string {
	if (amounts.length === 1 && amounts[0] === 1) {
		return `${i18n.t("commands:shop.shopItemsDisplaySingle", {
			lng,
			name: shopItemNames.normal,
			price: reaction.price,
			currency: data.currency,
			remainingPotions: data.additionalShopData!.remainingPotions
		})}\n`;
	}

	let desc = "";
	for (const amount of amounts) {
		desc += `${i18n.t("commands:shop.shopItemsDisplayMultiple", {
			lng,
			name: shopItemNames.normal,
			amount,
			price: reaction.price * amount,
			currency: data.currency
		})}\n`;
	}
	return desc;
}

export async function shopCollector(context: PacketContext, packet: ReactionCollectorCreationPacket): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction!)!;
	const lng = interaction.userLanguage;
	const data = packet.data.data as ReactionCollectorShopData;

	const categories: string[] = [];
	for (const reaction of packet.reactions) {
		if (reaction.type === ReactionCollectorShopItemReaction.name && categories.indexOf((reaction.data as ReactionCollectorShopItemReaction).shopCategoryId) === -1) {
			categories.push((reaction.data as ReactionCollectorShopItemReaction).shopCategoryId);
		}
	}
	categories.sort((a, b) => a.localeCompare(b));
	let shopText = "";
	const select = new StringSelectMenuBuilder()
		.setCustomId("shop")
		.setPlaceholder(i18n.t("commands:shop.shopSelectPlaceholder", { lng }));
	for (const categoryId of categories) {
		let categoryItemsIds = packet.reactions.filter(
			reaction => reaction.type === ReactionCollectorShopItemReaction.name && (reaction.data as ReactionCollectorShopItemReaction).shopCategoryId === categoryId
		)
			.map(reaction => (reaction.data as ReactionCollectorShopItemReaction).shopItemId);

		// Remove duplicates from categoryItemsIds (in case of multiple amounts for the same item)
		categoryItemsIds = categoryItemsIds.filter((item, index) => categoryItemsIds.indexOf(item) === index);

		shopText += `${`**${i18n.t(`commands:shop.shopCategories.${categoryId}`, {
			lng,
			count: data.additionalShopData!.remainingPotions
		})}** :\n`
			.concat(...categoryItemsIds.map(id => {
				const reaction = packet.reactions.find(reaction => (reaction.data as ReactionCollectorShopItemReaction).shopItemId === id)!.data as ReactionCollectorShopItemReaction;
				const shopItemName = getShopItemNames(data, reaction.shopItemId, lng);

				select.addOptions(new StringSelectMenuOptionBuilder()
					.setLabel(shopItemName.short)
					.setDescription(i18n.t("commands:shop.shopItemsSelectDescription", {
						lng,
						price: reaction.price,
						currency: data.currency
					}))
					.setValue(shopItemTypeToId(reaction.shopItemId)));
				return getShopItemDisplay(data, reaction, lng, shopItemName, [1]);
			}))}\n`;
	}

	const closeShopButton = new ButtonBuilder()
		.setCustomId("closeShop")
		.setLabel(i18n.t("commands:shop.closeShopButton", { lng }))
		.setStyle(ButtonStyle.Secondary);

	const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(closeShopButton);
	const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

	const embed = new CrowniclesEmbed()
		.setTitle(i18n.t("commands:shop.title", { lng }))
		.setDescription(shopText + i18n.t("commands:shop.currentMoney", {
			lng,
			money: data.availableCurrency,
			currency: data.currency
		}));

	const reply = await interaction.reply({
		embeds: [embed],
		components: [selectRow, buttonRow],
		withResponse: true
	});

	if (!reply?.resource?.message) {
		return null;
	}

	const msg = reply.resource.message;

	const buttonCollector = msg.createMessageComponentCollector({
		time: packet.endTime - Date.now()
	});

	// It's always Core that ends the collector, so we can use a boolean to check if the collector has ended locally
	let hasEnded = false;

	buttonCollector.on("collect", async (msgComponentInteraction: MessageComponentInteraction) => {
		if (hasEnded) {
			return;
		}
		if (msgComponentInteraction.user.id !== context.discord?.user) {
			await sendInteractionNotForYou(msgComponentInteraction.user, msgComponentInteraction, lng);
			return;
		}

		hasEnded = true;

		selectRow.components[0].setDisabled(true);

		buttonRow.components.forEach(component => {
			component.setDisabled(true);
		});

		await msgComponentInteraction.update({ components: [selectRow, buttonRow] });

		if (msgComponentInteraction.customId === "closeShop") {
			DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, msgComponentInteraction, packet.reactions.findIndex(r =>
				r.type === ReactionCollectorShopCloseReaction.name));
			return;
		}

		await manageBuyoutConfirmation(
			packet,
			context,
			data,
			packet.reactions.find(
				reaction =>
					reaction.type === ReactionCollectorShopItemReaction.name
					&& (reaction.data as ReactionCollectorShopItemReaction).shopItemId === shopItemTypeFromId((msgComponentInteraction as SelectMenuInteraction).values[0])
			)!.data as ReactionCollectorShopItemReaction
		);
	});

	buttonCollector.on("end", async () => {
		selectRow.components[0].setDisabled(true);

		buttonRow.components.forEach(component => {
			component.setDisabled(true);
		});

		await msg.edit({
			components: [selectRow, buttonRow]
		});
	});

	return [buttonCollector];
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("shop"),
	getPacket,
	mainGuildCommand: false
};
