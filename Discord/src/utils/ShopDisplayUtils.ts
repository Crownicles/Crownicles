import {
	PacketContext
} from "../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../bot/DiscordCache";
import { CrowniclesEmbed } from "../messages/CrowniclesEmbed";
import i18n from "../translations/i18n";
import {
	sendErrorMessage, sendInteractionNotForYou, SendManner
} from "./ErrorUtils";
import { ReactionCollectorCreationPacket } from "../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import {
	CommandShopGenericPurchase,
	CommandShopNotEnoughCurrency,
	ReactionCollectorShopCloseReaction,
	ReactionCollectorShopData,
	ReactionCollectorShopItemReaction
} from "../../../Lib/src/packets/interaction/ReactionCollectorShop";
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonInteraction,
	ButtonStyle,
	ContainerBuilder,
	Message,
	MessageComponentInteraction,
	parseEmoji
} from "discord.js";
import { CrowniclesIcons } from "../../../Lib/src/CrowniclesIcons";
import {
	disableRows, DiscordCollectorUtils
} from "./DiscordCollectorUtils";
import {
	ReactionCollectorBuyCategorySlotCancelReaction,
	ReactionCollectorBuyCategorySlotReaction
} from "../../../Lib/src/packets/interaction/ReactionCollectorBuyCategorySlot";
import {
	shopItemTypeFromId, shopItemTypeToId
} from "../../../Lib/src/utils/ShopUtils";
import { ReactionCollectorReturnTypeOrNull } from "../packetHandlers/handlers/ReactionCollectorHandlers";
import { escapeUsername } from "./StringUtils";
import { Badge } from "../../../Lib/src/types/Badge";
import { Constants } from "../../../Lib/src/constants/Constants";
import {
	buildShopConfirmationContainer,
	buildShopMainContainer,
	CITY_SHOP_CUSTOM_IDS,
	groupReactionsByItem,
	parseShopAmountCustomId
} from "./cityShop/CityShopViews";

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

export async function handleCommandShopNoPlantSlotAvailable(context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction!);

	if (interaction) {
		await sendErrorMessage(interaction.user, context, interaction, i18n.t("commands:shop.noPlantSlotAvailable", { lng: interaction.userLanguage }), { sendManner: SendManner.FOLLOWUP });
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

export async function handleCommandShopGenericPurchase(packet: CommandShopGenericPurchase, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction!);
	if (!interaction) {
		return;
	}
	const lng = interaction.userLanguage;
	const itemName = i18n.t(`commands:shop.shopItems.${shopItemTypeToId(packet.shopItemId)}.name`, {
		lng,
		...packet.translationParams
	});

	let description = i18n.t("commands:shop.genericPurchase", {
		lng,
		item: itemName,
		count: packet.amount
	});

	if (packet.materials) {
		const materialLines = Object.entries(packet.materials)
			.map(([materialId, quantity]) => i18n.t("commands:shop.materialLine", {
				lng,
				materialId,
				quantity
			}));
		description += `\n\n${materialLines.join("\n")}`;
	}

	await interaction.followUp({
		embeds: [
			new CrowniclesEmbed()
				.formatAuthor(i18n.t("commands:shop.success", {
					lng,
					pseudo: escapeUsername(interaction.user.displayName)
				}), interaction.user)
				.setDescription(description)
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

		await msg.edit({ components: [row] });
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

type ShopUiState =
	| {
		kind: "main"; container: ContainerBuilder;
	}
	| {
		kind: "confirmation"; container: ContainerBuilder; itemReactions: ReactionCollectorShopItemReaction[];
	};

interface ShopDispatchDeps {
	customId: string;
	packet: ReactionCollectorCreationPacket;
	context: PacketContext;
	reactionsByItem: ReturnType<typeof groupReactionsByItem>;
	showMainView: (buttonInteraction: ButtonInteraction) => Promise<void>;
	showConfirmationView: (
		buttonInteraction: ButtonInteraction,
		itemReactions: ReactionCollectorShopItemReaction[]
	) => Promise<void>;
	consumeAndDisable: (buttonInteraction: ButtonInteraction) => Promise<void>;
	getState: () => ShopUiState;
}

async function handleShopCloseButton(buttonInteraction: ButtonInteraction, deps: ShopDispatchDeps): Promise<void> {
	await deps.consumeAndDisable(buttonInteraction);
	DiscordCollectorUtils.sendReaction(
		deps.packet,
		deps.context,
		deps.context.keycloakId!,
		buttonInteraction,
		deps.packet.reactions.findIndex(r => r.type === ReactionCollectorShopCloseReaction.name)
	);
}

async function handleShopBuyButton(buttonInteraction: ButtonInteraction, deps: ShopDispatchDeps): Promise<void> {
	const itemIdStr = deps.customId.slice(CITY_SHOP_CUSTOM_IDS.BUY_PREFIX.length);
	const itemId = shopItemTypeFromId(itemIdStr);
	const itemReactions = deps.reactionsByItem.get(itemId);
	if (!itemReactions) {
		return;
	}
	await deps.showConfirmationView(buttonInteraction, itemReactions);
}

async function handleShopAmountButton(buttonInteraction: ButtonInteraction, deps: ShopDispatchDeps): Promise<void> {
	if (deps.getState().kind !== "confirmation") {
		return;
	}
	const parsed = parseShopAmountCustomId(deps.customId);
	if (!parsed) {
		return;
	}
	const itemId = shopItemTypeFromId(parsed.itemIdStr);
	await deps.consumeAndDisable(buttonInteraction);
	DiscordCollectorUtils.sendReaction(
		deps.packet,
		deps.context,
		deps.context.keycloakId!,
		null,
		deps.packet.reactions.findIndex(r => r.type === ReactionCollectorShopItemReaction.name
			&& (r.data as ReactionCollectorShopItemReaction).shopItemId === itemId
			&& (r.data as ReactionCollectorShopItemReaction).amount === parsed.amount)
	);
}

async function dispatchShopButton(buttonInteraction: ButtonInteraction, deps: ShopDispatchDeps): Promise<void> {
	if (deps.customId === CITY_SHOP_CUSTOM_IDS.CLOSE) {
		await handleShopCloseButton(buttonInteraction, deps);
		return;
	}
	if (deps.customId === CITY_SHOP_CUSTOM_IDS.CANCEL_PURCHASE) {
		await deps.showMainView(buttonInteraction);
		return;
	}
	if (deps.customId.startsWith(CITY_SHOP_CUSTOM_IDS.BUY_PREFIX)) {
		await handleShopBuyButton(buttonInteraction, deps);
		return;
	}
	if (deps.customId.startsWith(CITY_SHOP_CUSTOM_IDS.AMOUNT_PREFIX)) {
		await handleShopAmountButton(buttonInteraction, deps);
	}
}

export async function shopCollector(context: PacketContext, packet: ReactionCollectorCreationPacket): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction!)!;
	const lng = interaction.userLanguage;
	const data = packet.data.data as ReactionCollectorShopData;

	const reactionsByItem = groupReactionsByItem(packet);
	const mainContainer = buildShopMainContainer({
		data,
		reactionsByItem,
		pseudo: interaction.user.displayName,
		lng
	});

	const messagePayload = {
		embeds: [],
		components: [mainContainer],
		flags: ["IsComponentsV2"] as const
	};

	let msg: Message | null;
	if (interaction.replied) {
		msg = await interaction.followUp(messagePayload);
	}
	else if (interaction.deferred) {
		msg = await interaction.editReply(messagePayload);
	}
	else {
		const reply = await interaction.reply({
			...messagePayload,
			withResponse: true
		});
		msg = reply?.resource?.message ?? null;
	}

	if (!msg) {
		return null;
	}

	let state: ShopUiState = {
		kind: "main",
		container: mainContainer
	};

	const buttonCollector = msg.createMessageComponentCollector({
		time: packet.endTime - Date.now()
	});

	/*
	 * Core controls the collector lifecycle (purchase end or close reaction). Track local
	 * "consumed" state to prevent double-clicks racing during the network round-trip.
	 */
	let isConsumed = false;

	const showMainView = async (buttonInteraction: ButtonInteraction): Promise<void> => {
		const freshMain = buildShopMainContainer({
			data,
			reactionsByItem,
			pseudo: interaction.user.displayName,
			lng
		});
		state = {
			kind: "main",
			container: freshMain
		};
		await buttonInteraction.update({
			embeds: [],
			components: [freshMain],
			flags: ["IsComponentsV2"]
		});
	};

	const showConfirmationView = async (
		buttonInteraction: ButtonInteraction,
		itemReactions: ReactionCollectorShopItemReaction[]
	): Promise<void> => {
		const container = buildShopConfirmationContainer({
			data,
			itemReactions,
			pseudo: interaction.user.displayName,
			lng
		});
		state = {
			kind: "confirmation",
			container,
			itemReactions
		};
		await buttonInteraction.update({
			embeds: [],
			components: [container],
			flags: ["IsComponentsV2"]
		});
	};

	const buildDisabledContainer = (): ContainerBuilder => state.kind === "main"
		? buildShopMainContainer({
			data,
			reactionsByItem,
			pseudo: interaction.user.displayName,
			lng,
			disabled: true
		})
		: buildShopConfirmationContainer({
			data,
			itemReactions: state.itemReactions,
			pseudo: interaction.user.displayName,
			lng,
			disabled: true
		});

	const consumeAndDisable = async (buttonInteraction: ButtonInteraction): Promise<void> => {
		isConsumed = true;
		const disabledContainer = buildDisabledContainer();
		await buttonInteraction.update({
			embeds: [],
			components: [disabledContainer],
			flags: ["IsComponentsV2"]
		});
	};

	buttonCollector.on("collect", async (msgComponentInteraction: MessageComponentInteraction) => {
		if (isConsumed || !msgComponentInteraction.isButton()) {
			return;
		}
		if (msgComponentInteraction.user.id !== context.discord?.user) {
			await sendInteractionNotForYou(msgComponentInteraction.user, msgComponentInteraction, lng);
			return;
		}
		await dispatchShopButton(msgComponentInteraction, {
			customId: msgComponentInteraction.customId,
			packet,
			context,
			reactionsByItem,
			showMainView,
			showConfirmationView,
			consumeAndDisable,
			getState: () => state
		});
	});

	buttonCollector.on("end", async () => {
		if (isConsumed) {
			return;
		}
		const disabledContainer = buildDisabledContainer();
		await msg.edit({
			embeds: [],
			components: [disabledContainer],
			flags: ["IsComponentsV2"]
		});
	});

	return [buttonCollector];
}
