import {makePacket, PacketContext} from "../../../../Lib/src/packets/DraftBotPacket";
import {ICommand} from "../ICommand";
import {SlashCommandBuilderGenerator} from "../SlashCommandBuilderGenerator";
import {CommandShopPacketReq} from "../../../../Lib/src/packets/commands/CommandShopPacket";
import {DiscordCache} from "../../bot/DiscordCache";
import {DraftBotEmbed} from "../../messages/DraftBotEmbed";
import i18n from "../../translations/i18n";
import {sendErrorMessage, sendInteractionNotForYou, SendManner} from "../../utils/ErrorUtils";
import {ReactionCollectorCreationPacket} from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import {
	CommandShopNotEnoughCurrency,
	ReactionCollectorShopData,
	ReactionCollectorShopItemReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorShop";
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonInteraction,
	ButtonStyle,
	Message,
	MessageComponentInteraction,
	parseEmoji,
	SelectMenuInteraction,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder
} from "discord.js";
import {DisplayUtils} from "../../utils/DisplayUtils";
import {Constants} from "../../../../Lib/src/constants/Constants";
import {PacketUtils} from "../../utils/PacketUtils";
import {ChangeBlockingReasonPacket} from "../../../../Lib/src/packets/utils/ChangeBlockingReasonPacket";
import {BlockingConstants} from "../../../../Lib/src/constants/BlockingConstants";
import {DraftBotIcons} from "../../../../Lib/src/DraftBotIcons";
import {EmoteUtils} from "../../utils/EmoteUtils";
import {Language} from "../../../../Lib/src/Language";
import {DiscordCollectorUtils} from "../../utils/DiscordCollectorUtils";
import {ReactionCollectorBuyCategorySlotReaction} from "../../../../Lib/src/packets/interaction/ReactionCollectorBuyCategorySlot";
import {ShopItemType} from "../../../../Lib/src/constants/LogsConstants";
import {shopItemTypeFromId, shopItemTypeToId} from "../../../../Lib/src/utils/ShopUtils";

function getPacket(): CommandShopPacketReq {
	return makePacket(CommandShopPacketReq, {});
}

export async function handleCommandShopNoAlterationToHeal(context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction!);

	if (interaction) {
		await sendErrorMessage(interaction.user, interaction, i18n.t("commands:shop.noAlterationToHeal", {lng: interaction.userLanguage}), {sendManner: SendManner.FOLLOWUP});
	}
}

export async function handleCommandShopNoEnergyToHeal(context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction!);

	if (interaction) {
		await sendErrorMessage(interaction.user, interaction, i18n.t("commands:shop.noEnergyToHeal", {lng: interaction.userLanguage}), {sendManner: SendManner.FOLLOWUP});
	}
}

export async function handleCommandShopTooManyEnergyBought(context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction!);

	if (interaction) {
		await sendErrorMessage(interaction.user, interaction, i18n.t("commands:shop.tooManyEnergyBought", {lng: interaction.userLanguage}), {sendManner: SendManner.FOLLOWUP});
	}
}

export async function handleCommandShopAlreadyHaveBadge(context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction!);

	if (interaction) {
		await sendErrorMessage(interaction.user, interaction, i18n.t("commands:shop.alreadyHaveBadge", {lng: interaction.userLanguage}), {sendManner: SendManner.FOLLOWUP});
	}
}

export async function handleCommandShopBoughtTooMuchDailyPotions(context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction!);

	if (interaction) {
		await sendErrorMessage(interaction.user, interaction, i18n.t("commands:shop.boughtTooMuchDailyPotions", {lng: interaction.userLanguage}), {sendManner: SendManner.FOLLOWUP});
	}
}

export async function handleCommandShopNotEnoughMoney(packet: CommandShopNotEnoughCurrency, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction!);

	if (interaction) {
		await sendErrorMessage(interaction.user, interaction, i18n.t("commands:shop.notEnoughMoney", {
			lng: interaction.userLanguage,
			missingCurrency: packet.missingCurrency,
			currency: packet.currency
		}), {sendManner: SendManner.FOLLOWUP});
	}
}

export async function handleCommandShopHealAlterationDone(context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction!);

	await interaction?.followUp({
		embeds: [
			new DraftBotEmbed()
				.formatAuthor(i18n.t("commands:shop.success", {
					lng: interaction.userLanguage,
					pseudo: interaction.user.username
				}), interaction.user)
				.setDescription(i18n.t("commands:shop.healAlteration", {lng: interaction.userLanguage}))
		]
	});
}

export async function handleCommandShopFullRegen(context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction!);

	await interaction?.followUp({
		embeds: [
			new DraftBotEmbed()
				.formatAuthor(i18n.t("commands:shop.success", {
					lng: interaction.userLanguage,
					pseudo: interaction.user.username
				}), interaction.user)
				.setDescription(i18n.t("commands:shop.fullRegen", {lng: interaction.userLanguage}))
		]
	});
}

export async function handleCommandShopBadgeBought(context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction!);

	await interaction?.followUp({
		embeds: [
			new DraftBotEmbed()
				.formatAuthor(i18n.t("commands:shop.success", {
					lng: interaction.userLanguage,
					pseudo: interaction.user.username
				}), interaction.user)
				.setDescription(i18n.t("commands:shop.badgeBought", {
					lng: interaction.userLanguage,
					badgeName: "richPerson"
				}))
		]
	});
}

export async function shopInventoryExtensionCollector(packet: ReactionCollectorCreationPacket, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction!)!;

	const row = new ActionRowBuilder<ButtonBuilder>();
	let slotExtensionText = `${i18n.t("commands:shop.chooseSlotIndication", {lng: interaction.userLanguage})}\n\n`;
	for (const category of (packet.reactions.filter(reaction => reaction.type === ReactionCollectorBuyCategorySlotReaction.name).map(r => r.data) as ReactionCollectorBuyCategorySlotReaction[])) {
		const button = new ButtonBuilder()
			.setCustomId(category.categoryId.toString(10))
			.setEmoji(parseEmoji(DraftBotIcons.itemKinds[category.categoryId])!)
			.setStyle(ButtonStyle.Secondary);
		row.addComponents(button);
		slotExtensionText += i18n.t("commands:shop.shopCategoryFormat", {
			lng: interaction.userLanguage,
			category: i18n.t(`commands:shop.slotCategoriesKind.${category.categoryId.toString(10)}`, {lng: interaction.userLanguage}),
			count: category.remaining,
			limit: category.maxSlots,
			categoryId: category.categoryId
		});
	}
	const closeShopButton = new ButtonBuilder()
		.setCustomId("closeShop")
		.setLabel(i18n.t("commands:shop.closeShopButton", {lng: interaction.userLanguage}))
		.setStyle(ButtonStyle.Secondary);

	row.addComponents(closeShopButton);

	const msg = await interaction.followUp({
		embeds: [
			new DraftBotEmbed()
				.formatAuthor(i18n.t("commands:shop.chooseSlotTitle", {
					lng: interaction.userLanguage,
					pseudo: interaction.user.username
				}), interaction.user)
				.setDescription(slotExtensionText)
		],
		components: [row]
	});

	const buttonCollector = msg.createMessageComponentCollector({
		time: Constants.MESSAGES.COLLECTOR_TIME
	});

	buttonCollector.on("collect", async (i: ButtonInteraction) => {
		if (i.user.id !== context.discord?.user) {
			await sendInteractionNotForYou(i.user, i, interaction.userLanguage);
			return;
		}
		await i.update({components: []});
		buttonCollector.stop();
	});

	buttonCollector.on("end", async (collected) => {
		if (!collected.first() || collected.first()?.customId === "closeShop") {
			PacketUtils.sendPacketToBackend(context, makePacket(ChangeBlockingReasonPacket, {
				oldReason: BlockingConstants.REASONS.SHOP,
				newReason: BlockingConstants.REASONS.NONE
			}));
			await handleCommandShopClosed(context);
			return;
		}
		const firstReaction = collected.first() as ButtonInteraction;
		PacketUtils.sendPacketToBackend(context, makePacket(ChangeBlockingReasonPacket, {
			oldReason: BlockingConstants.REASONS.SHOP,
			newReason: BlockingConstants.REASONS.NONE
		}));
		DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, null, packet.reactions.findIndex(r =>
			r.type === ReactionCollectorBuyCategorySlotReaction.name
			&& (r.data as ReactionCollectorBuyCategorySlotReaction).categoryId === parseInt(firstReaction.customId, 10)));
	});
}

export async function handleReactionCollectorBuyCategorySlotBuySuccess(context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction!);

	await interaction?.followUp({
		embeds: [
			new DraftBotEmbed()
				.formatAuthor(i18n.t("commands:shop.success", {
					lng: interaction.userLanguage,
					pseudo: interaction.user.username
				}), interaction.user)
				.setDescription(i18n.t("commands:shop.buyCategorySlotSuccess", {lng: interaction.userLanguage}))
		]
	});
}

export async function handleCommandShopClosed(context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction!)!;
	const args = {
		embeds: [
			new DraftBotEmbed()
				.formatAuthor(i18n.t("commands:shop.closeShopTitle", {
					lng: interaction.userLanguage,
					pseudo: interaction.user.username
				}), interaction.user)
				.setDescription(i18n.t("commands:shop.closeShop", {lng: interaction.userLanguage}))
		]
	};
	await (interaction.replied ? interaction.followUp(args) : interaction.reply(args));
}

async function manageBuyoutConfirmation(packet: ReactionCollectorCreationPacket, context: PacketContext, data: ReactionCollectorShopData, reaction: ReactionCollectorShopItemReaction): Promise<void> {
	PacketUtils.sendPacketToBackend(context, makePacket(ChangeBlockingReasonPacket, {
		oldReason: BlockingConstants.REASONS.SHOP,
		newReason: BlockingConstants.REASONS.SHOP_CONFIRMATION
	}));

	const interaction = DiscordCache.getInteraction(context.discord!.interaction!);
	if (!interaction) {
		return;
	}
	const shopItemId = reaction.shopItemId;

	const amounts = packet.reactions.filter(r => {
		const shopData = r.data as ReactionCollectorShopItemReaction;
		return r.type === ReactionCollectorShopItemReaction.name && shopData.shopItemId === reaction.shopItemId;
	}).map(r => (r.data as ReactionCollectorShopItemReaction).amount);

	const row = new ActionRowBuilder<ButtonBuilder>();

	if (amounts.length === 1 && amounts[0] === 1) {
		const buttonAccept = new ButtonBuilder()
			.setEmoji(parseEmoji(DraftBotIcons.collectors.accept)!)
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
		.setEmoji(parseEmoji(DraftBotIcons.collectors.refuse)!)
		.setCustomId("refuse")
		.setStyle(ButtonStyle.Secondary);
	row.addComponents(buttonRefuse);

	const shopItemNames = getShopItemNames(data, shopItemId, interaction.userLanguage);

	const msg = await interaction.followUp({
		embeds: [
			new DraftBotEmbed()
				.formatAuthor(i18n.t(amounts.length === 1 && amounts[0] === 1 ? "commands:shop.shopConfirmationTitle" : "commands:shop.shopConfirmationTitleMultiple", {
					lng: interaction.userLanguage,
					pseudo: interaction.user.username
				}), interaction.user)
				.setDescription(`${
					getShopItemDisplay(data, reaction, interaction.userLanguage, shopItemNames, amounts)
				}\n${EmoteUtils.translateEmojiToDiscord(DraftBotIcons.collectors.warning)} ${
					i18n.t(`commands:shop.shopItems.${shopItemTypeToId(shopItemId)}.info`, {
						lng: interaction.userLanguage,
						kingsMoneyAmount: data.additionnalShopData?.gemToMoneyRatio,
						thousand_points: Constants.MISSION_SHOP.THOUSAND_POINTS,
					})
				}`)
		],
		components: [row]
	});

	const buttonCollector = msg.createMessageComponentCollector({
		time: Constants.MESSAGES.COLLECTOR_TIME
	});

	let collectedInteraction: MessageComponentInteraction | null = null;

	buttonCollector.on("collect", async (i: ButtonInteraction) => {
		if (i.user.id !== context.discord?.user) {
			await sendInteractionNotForYou(i.user, i, interaction.userLanguage);
			return;
		}
		collectedInteraction = i;
		await collectedInteraction.update({components: []});
		buttonCollector.stop();
	});
	buttonCollector.on("end", async (collected) => {
		PacketUtils.sendPacketToBackend(context, makePacket(ChangeBlockingReasonPacket, {
			oldReason: BlockingConstants.REASONS.SHOP_CONFIRMATION,
			newReason: BlockingConstants.REASONS.NONE
		}));
		if (!collected.first() || collected.first()?.customId === "refuse") {
			await handleCommandShopClosed(context);
			return;
		}
		DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, null, packet.reactions.findIndex(r =>
			r.type === ReactionCollectorShopItemReaction.name
			&& (r.data as ReactionCollectorShopItemReaction).shopItemId === reaction.shopItemId
			&& (amounts.length === 1 || (r.data as ReactionCollectorShopItemReaction).amount === parseInt(collectedInteraction!.customId, 10))));
	});

}

type ShopItemNames = {
	normal: string,
	short: string
}

function getShopItemNames(data: ReactionCollectorShopData, shopItemId: ShopItemType, lng: Language): ShopItemNames {
	if (shopItemId === ShopItemType.DAILY_POTION) {
		return {
			normal: DisplayUtils.getItemDisplayWithStats(data.additionnalShopData!.dailyPotion!, lng),
			short: DisplayUtils.getItemDisplay({
				id: data.additionnalShopData!.dailyPotion!.id,
				category: data.additionnalShopData!.dailyPotion!.category
			}, lng)
		};
	}
	const bothNames = i18n.t(`commands:shop.shopItems.${shopItemTypeToId(shopItemId)}.name`, {
		lng,
		interpolation: {escapeValue: false}
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
			interpolation: {escapeValue: false},
			remainingPotions: data.additionnalShopData!.remainingPotions
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

export async function shopCollector(packet: ReactionCollectorCreationPacket, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction!)!;
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
		.setPlaceholder(i18n.t("commands:shop.shopSelectPlaceholder", {lng: interaction.userLanguage}));
	for (const categoryId of categories) {
		let categoryItemsIds = packet.reactions.filter(
			reaction => reaction.type === ReactionCollectorShopItemReaction.name && (reaction.data as ReactionCollectorShopItemReaction).shopCategoryId === categoryId
		)
			.map(reaction => (reaction.data as ReactionCollectorShopItemReaction).shopItemId);
		// Remove duplicates from categoryItemsIds (in case of multiple amounts for the same item)
		categoryItemsIds = categoryItemsIds.filter((item, index) => categoryItemsIds.indexOf(item) === index);

		shopText += `${`**${i18n.t(`commands:shop.shopCategories.${categoryId}`, {
			lng: interaction.userLanguage,
			count: data.additionnalShopData!.remainingPotions
		})}** :\n`
			.concat(...categoryItemsIds.map(id => {
				const reaction = packet.reactions.find(reaction => (reaction.data as ReactionCollectorShopItemReaction).shopItemId === id)!.data as ReactionCollectorShopItemReaction;
				const shopItemName = getShopItemNames(data, reaction.shopItemId, interaction.userLanguage);

				select.addOptions(new StringSelectMenuOptionBuilder()
					.setLabel(shopItemName.short)
					.setDescription(i18n.t("commands:shop.shopItemsSelectDescription", {
						lng: interaction.userLanguage,
						price: reaction.price,
						currency: data.currency
					}))
					.setValue(shopItemTypeToId(reaction.shopItemId)));
				return getShopItemDisplay(data, reaction, interaction.userLanguage, shopItemName, [1]);
			}))}\n`;
	}

	const closeShopButton = new ButtonBuilder()
		.setCustomId("closeShop")
		.setLabel(i18n.t("commands:shop.closeShopButton", {lng: interaction.userLanguage}))
		.setStyle(ButtonStyle.Secondary);

	const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(closeShopButton);
	const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

	const embed = new DraftBotEmbed()
		.setTitle(i18n.t("commands:shop.title", {lng: interaction.userLanguage}))
		.setDescription(shopText + i18n.t("commands:shop.currentMoney", {
			lng: interaction.userLanguage,
			money: data.availableCurrency,
			currency: data.currency
		}));

	const msg = await interaction.reply({
		embeds: [embed],
		components: [selectRow, buttonRow],
		fetchReply: true
	}) as Message;

	const buttonCollector = msg.createMessageComponentCollector({
		time: packet.endTime - Date.now()
	});

	buttonCollector.on("collect", async (i: MessageComponentInteraction) => {
		if (i.user.id !== context.discord?.user) {
			await sendInteractionNotForYou(i.user, i, interaction.userLanguage);
			return;
		}
		await i.update({components: []});
		buttonCollector.stop();
	});
	buttonCollector.on("end", async (collected) => {
		if (!collected.first() || collected.first()?.customId === "closeShop") {
			PacketUtils.sendPacketToBackend(context, makePacket(ChangeBlockingReasonPacket, {
				oldReason: BlockingConstants.REASONS.SHOP,
				newReason: BlockingConstants.REASONS.NONE
			}));
			await handleCommandShopClosed(context);
			return;
		}
		const firstReactionId = shopItemTypeFromId((collected.first() as SelectMenuInteraction).values[0]);
		await manageBuyoutConfirmation(
			packet,
			context,
			data,
			packet.reactions.find(
				reaction =>
					reaction.type === ReactionCollectorShopItemReaction.name
					&& (reaction.data as ReactionCollectorShopItemReaction).shopItemId === firstReactionId
			)!.data as ReactionCollectorShopItemReaction
		);

	});

}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("shop"),
	getPacket,
	mainGuildCommand: false
};