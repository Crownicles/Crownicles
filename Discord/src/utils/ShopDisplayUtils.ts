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
import { Language } from "../../../Lib/src/Language";
import {
	buildShopConfirmationContainer,
	buildShopMainContainer,
	CITY_SHOP_CUSTOM_IDS,
	groupReactionsByItem,
	parseShopAmountCustomId
} from "./cityShop/CityShopViews";

/**
 * discord.js message flag enabling the Components V2 layout (containers,
 * sections, separators...). Centralised here to keep the magic string in a
 * single place across all `update` / `edit` / `reply` calls of the shop flow.
 */
const COMPONENTS_V2_FLAGS = ["IsComponentsV2"] as const;

/**
 * Common scaffolding for "shop success" notifications. Resolves the
 * interaction, formats the title with the user pseudo and posts the
 * description as a followUp (or as a reply when the interaction has not
 * been answered yet — e.g. when Core forwards a packet without the player
 * having opened the shop UI in the current command flow).
 */
async function sendShopSuccess(
	context: PacketContext,
	options: {
		titleKey?: string;
		buildDescription: (lng: Language) => string;
	}
): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction!);
	if (!interaction) {
		return;
	}
	const lng = interaction.userLanguage;
	const titleKey = options.titleKey ?? "commands:shop.success";
	const payload = {
		embeds: [
			new CrowniclesEmbed()
				.formatAuthor(i18n.t(titleKey, {
					lng,
					pseudo: escapeUsername(interaction.user.displayName)
				}), interaction.user)
				.setDescription(options.buildDescription(lng))
		]
	};
	await (interaction.replied ? interaction.followUp(payload) : interaction.reply(payload));
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
	await sendShopSuccess(context, {
		buildDescription: lng => i18n.t("commands:shop.healAlteration", { lng })
	});
}

export async function handleCommandShopBadgeBought(context: PacketContext): Promise<void> {
	await sendShopSuccess(context, {
		buildDescription: lng => i18n.t("commands:shop.badgeBought", {
			lng,
			badgeName: Badge.RICH
		})
	});
}

export async function handleCommandShopGenericPurchase(packet: CommandShopGenericPurchase, context: PacketContext): Promise<void> {
	await sendShopSuccess(context, {
		buildDescription: lng => {
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
			return description;
		}
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
	await sendShopSuccess(context, {
		buildDescription: lng => i18n.t("commands:shop.buyCategorySlotSuccess", { lng })
	});
}

export async function handleCommandShopClosed(context: PacketContext): Promise<void> {
	await sendShopSuccess(context, {
		titleKey: "commands:shop.closeShopTitle",
		buildDescription: lng => i18n.t("commands:shop.closeShop", { lng })
	});
}

type ShopUiState =
	| {
		kind: "main"; container: ContainerBuilder;
	}
	| {
		kind: "confirmation"; container: ContainerBuilder; itemReactions: ReactionCollectorShopItemReaction[];
	};

interface ShopUiControllerArgs {
	data: ReactionCollectorShopData;
	reactionsByItem: ReturnType<typeof groupReactionsByItem>;
	pseudo: string;
	lng: Language;
	initialContainer: ContainerBuilder;
	msg: Message;
}

/**
 * Encapsulates the city-shop view state machine: tracks whether the UI is
 * currently showing the main item list or a purchase confirmation, holds the
 * "consumed" flag that prevents double clicks racing with the network round
 * trip to Core, and owns the rebuild logic for every state transition.
 *
 * `shopCollector` wires the discord.js collector events to instance methods;
 * keeping the mutable state inside a class makes the transitions and their
 * invariants explicit and self-contained.
 */
class ShopUiController {
	private state: ShopUiState;

	private consumed = false;

	constructor(private readonly args: ShopUiControllerArgs) {
		this.state = {
			kind: "main",
			container: args.initialContainer
		};
	}

	isConsumed(): boolean {
		return this.consumed;
	}

	getState(): ShopUiState {
		return this.state;
	}

	async showMainView(buttonInteraction: ButtonInteraction): Promise<void> {
		const freshMain = this.buildMain(false);
		this.state = {
			kind: "main",
			container: freshMain
		};
		await buttonInteraction.update({
			embeds: [],
			components: [freshMain],
			flags: COMPONENTS_V2_FLAGS
		});
	}

	async showConfirmationView(
		buttonInteraction: ButtonInteraction,
		itemReactions: ReactionCollectorShopItemReaction[]
	): Promise<void> {
		const container = this.buildConfirmation(itemReactions, false);
		this.state = {
			kind: "confirmation",
			container,
			itemReactions
		};
		await buttonInteraction.update({
			embeds: [],
			components: [container],
			flags: COMPONENTS_V2_FLAGS
		});
	}

	async consumeAndDisable(buttonInteraction: ButtonInteraction): Promise<void> {
		this.consumed = true;
		await buttonInteraction.update({
			embeds: [],
			components: [this.buildDisabledContainer()],
			flags: COMPONENTS_V2_FLAGS
		});
	}

	async disableOnEnd(): Promise<void> {
		await this.args.msg.edit({
			embeds: [],
			components: [this.buildDisabledContainer()],
			flags: COMPONENTS_V2_FLAGS
		});
	}

	private buildMain(disabled: boolean): ContainerBuilder {
		return buildShopMainContainer({
			data: this.args.data,
			reactionsByItem: this.args.reactionsByItem,
			pseudo: this.args.pseudo,
			lng: this.args.lng,
			disabled
		});
	}

	private buildConfirmation(itemReactions: ReactionCollectorShopItemReaction[], disabled: boolean): ContainerBuilder {
		return buildShopConfirmationContainer({
			data: this.args.data,
			itemReactions,
			pseudo: this.args.pseudo,
			lng: this.args.lng,
			disabled
		});
	}

	private buildDisabledContainer(): ContainerBuilder {
		return this.state.kind === "main"
			? this.buildMain(true)
			: this.buildConfirmation(this.state.itemReactions, true);
	}
}

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
	const pseudo = interaction.user.displayName;

	const reactionsByItem = groupReactionsByItem(packet);
	const mainContainer = buildShopMainContainer({
		data,
		reactionsByItem,
		pseudo,
		lng
	});

	const messagePayload = {
		embeds: [],
		components: [mainContainer],
		flags: COMPONENTS_V2_FLAGS
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

	const controller = new ShopUiController({
		data, reactionsByItem, pseudo, lng, initialContainer: mainContainer, msg
	});
	const buttonCollector = msg.createMessageComponentCollector({
		time: packet.endTime - Date.now()
	});

	buttonCollector.on("collect", async (msgComponentInteraction: MessageComponentInteraction) => {
		if (controller.isConsumed() || !msgComponentInteraction.isButton()) {
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
			showMainView: i => controller.showMainView(i),
			showConfirmationView: (i, r) => controller.showConfirmationView(i, r),
			consumeAndDisable: i => controller.consumeAndDisable(i),
			getState: () => controller.getState()
		});
	});

	buttonCollector.on("end", async () => {
		if (controller.isConsumed()) {
			return;
		}
		await controller.disableOnEnd();
	});

	return [buttonCollector];
}
