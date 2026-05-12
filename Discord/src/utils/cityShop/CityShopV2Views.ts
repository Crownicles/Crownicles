import {
	ActionRowBuilder, ButtonBuilder, ButtonStyle,
	ContainerBuilder, SectionBuilder, SeparatorBuilder, SeparatorSpacingSize,
	TextDisplayBuilder
} from "discord.js";
import i18n from "../../translations/i18n";
import { CrowniclesIcons } from "../../../../Lib/src/CrowniclesIcons";
import { Language } from "../../../../Lib/src/Language";
import { Constants } from "../../../../Lib/src/constants/Constants";
import { ShopItemType } from "../../../../Lib/src/constants/LogsConstants";
import {
	ReactionCollectorShopData, ReactionCollectorShopItemReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorShop";
import { ReactionCollectorCreationPacket } from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { DisplayUtils } from "../DisplayUtils";
import { shopItemTypeToId } from "../../../../Lib/src/utils/ShopUtils";
import { escapeUsername } from "../StringUtils";

export const CITY_SHOP_CUSTOM_IDS = {
	BUY_PREFIX: "cityShopBuy_",
	AMOUNT_PREFIX: "cityShopAmount_",
	CANCEL_PURCHASE: "cityShopCancelPurchase",
	CLOSE: "cityShopClose"
} as const;

export type CityShopReactionsByItem = Map<ShopItemType, ReactionCollectorShopItemReaction[]>;

interface ShopItemDisplay {
	fullName: string;
	shortLabel: string;
	unitPrice: number;
	amounts: number[];
}

/**
 * Group shop item reactions by `shopItemId`. Each item can expose several amounts
 * which appear as separate reactions; here we keep them ordered together so we can
 * later present a single "buy" button per item that opens an amount picker.
 */
export function groupReactionsByItem(packet: ReactionCollectorCreationPacket): CityShopReactionsByItem {
	const byItem: CityShopReactionsByItem = new Map();
	for (const reaction of packet.reactions) {
		if (reaction.type !== ReactionCollectorShopItemReaction.name) {
			continue;
		}
		const data = reaction.data as ReactionCollectorShopItemReaction;
		const list = byItem.get(data.shopItemId);
		if (list) {
			list.push(data);
		}
		else {
			byItem.set(data.shopItemId, [data]);
		}
	}
	return byItem;
}

/**
 * Build the display info (name, short label, unit price, amounts) for a single shop item.
 * The short label is reused as the "Buy" button label, hence must stay under Discord's
 * 80-character limit.
 */
function buildItemDisplay(
	data: ReactionCollectorShopData,
	itemReactions: ReactionCollectorShopItemReaction[],
	lng: Language
): ShopItemDisplay {
	const itemId = itemReactions[0].shopItemId;
	const amounts = itemReactions.map(r => r.amount);
	const unitAmount = Math.min(...amounts);
	const unitReaction = itemReactions.find(r => r.amount === unitAmount)!;
	const unitPrice = unitReaction.price / unitAmount;

	if (itemId === ShopItemType.DAILY_POTION) {
		return {
			fullName: DisplayUtils.getItemDisplayWithStats(data.additionalShopData!.dailyPotion!, lng),
			shortLabel: DisplayUtils.getSimpleItemDisplay({
				id: data.additionalShopData!.dailyPotion!.id,
				category: data.additionalShopData!.dailyPotion!.itemCategory
			}, lng),
			unitPrice,
			amounts
		};
	}
	if (itemId >= ShopItemType.WEEKLY_PLANT_TIER_1 && itemId <= ShopItemType.WEEKLY_PLANT_TIER_3) {
		const tierIndex = itemId - ShopItemType.WEEKLY_PLANT_TIER_1;
		const plantId = data.additionalShopData?.weeklyPlants?.[tierIndex];
		const name = i18n.t(`commands:shop.shopItems.${shopItemTypeToId(itemId)}.name`, {
			lng, plantId
		});
		return {
			fullName: `**${name}**`,
			shortLabel: name,
			unitPrice,
			amounts
		};
	}
	const name = i18n.t(`commands:shop.shopItems.${shopItemTypeToId(itemId)}.name`, { lng });
	return {
		fullName: `**${name}**`,
		shortLabel: name,
		unitPrice,
		amounts
	};
}

/**
 * Truncate the button label so it fits Discord's 80-character limit while keeping
 * the leading emoji marker intact when possible. Items with long names (e.g. potions
 * with stat lines) are rendered as buttons here so we have to be defensive.
 */
function clampButtonLabel(label: string): string {
	const MAX = 80;
	if (label.length <= MAX) {
		return label;
	}
	return `${label.slice(0, MAX - 1)}…`;
}

function buildItemSection(
	display: ShopItemDisplay,
	itemReactions: ReactionCollectorShopItemReaction[],
	data: ReactionCollectorShopData,
	lng: Language
): SectionBuilder {
	const hasMultipleAmounts = display.amounts.length > 1 || display.amounts[0] !== 1;
	const priceLine = hasMultipleAmounts
		? i18n.t("commands:shop.v2.itemPriceUnit", {
			lng,
			price: display.unitPrice,
			currency: data.currency
		})
		: i18n.t("commands:shop.v2.itemPrice", {
			lng,
			price: itemReactions[0].price,
			currency: data.currency
		});

	return new SectionBuilder()
		.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(`${display.fullName}\n${priceLine}`)
		)
		.setButtonAccessory(
			new ButtonBuilder()
				.setCustomId(`${CITY_SHOP_CUSTOM_IDS.BUY_PREFIX}${shopItemTypeToId(itemReactions[0].shopItemId)}`)
				.setLabel(clampButtonLabel(i18n.t("commands:shop.v2.buyButton", { lng })))
				.setStyle(ButtonStyle.Primary)
		);
}

interface MainShopViewArgs {
	packet: ReactionCollectorCreationPacket;
	data: ReactionCollectorShopData;
	reactionsByItem: CityShopReactionsByItem;
	pseudo: string;
	lng: Language;
}

/**
 * Group items by their category id, preserving discovery order within each category.
 */
function groupItemsByCategory(reactionsByItem: CityShopReactionsByItem): Map<string, ShopItemType[]> {
	const categoryToItems = new Map<string, ShopItemType[]>();
	for (const [itemId, reactions] of reactionsByItem) {
		const categoryId = reactions[0].shopCategoryId;
		const list = categoryToItems.get(categoryId);
		if (list) {
			list.push(itemId);
		}
		else {
			categoryToItems.set(categoryId, [itemId]);
		}
	}
	return categoryToItems;
}

/**
 * Append a category block (separator + title + per-item sections) to the container.
 */
function appendCategoryBlock(
	container: ContainerBuilder,
	categoryId: string,
	itemIds: ShopItemType[],
	data: ReactionCollectorShopData,
	reactionsByItem: CityShopReactionsByItem,
	lng: Language
): void {
	container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			`**${i18n.t(`commands:shop.shopCategories.${categoryId}`, {
				lng,
				count: data.additionalShopData?.remainingPotions
			})}**`
		)
	);
	for (const itemId of itemIds) {
		const itemReactions = reactionsByItem.get(itemId)!;
		const display = buildItemDisplay(data, itemReactions, lng);
		container.addSectionComponents(buildItemSection(display, itemReactions, data, lng));
	}
}

/**
 * Main shop view rendered as a Components V2 container.
 * One section per item with a "buy" button accessory; a single close button at the bottom.
 */
export function buildShopMainContainer(args: MainShopViewArgs): ContainerBuilder {
	const {
		data, reactionsByItem, pseudo, lng
	} = args;
	const container = new ContainerBuilder();

	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(`### ${i18n.t("commands:shop.title", { lng })}`)
	);

	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			i18n.t("commands:shop.v2.greeting", {
				lng,
				pseudo: escapeUsername(pseudo)
			})
		)
	);

	const categoryToItems = groupItemsByCategory(reactionsByItem);
	const categories = [...categoryToItems.keys()].sort((a, b) => a.localeCompare(b));

	for (const categoryId of categories) {
		appendCategoryBlock(container, categoryId, categoryToItems.get(categoryId)!, data, reactionsByItem, lng);
	}

	container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			i18n.t("commands:shop.currentMoney", {
				lng,
				money: data.availableCurrency,
				currency: data.currency
			})
		)
	);

	container.addActionRowComponents(
		new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setCustomId(CITY_SHOP_CUSTOM_IDS.CLOSE)
				.setLabel(i18n.t("commands:shop.closeShopButton", { lng }))
				.setStyle(ButtonStyle.Secondary)
		)
	);

	return container;
}

interface ConfirmationViewArgs {
	data: ReactionCollectorShopData;
	itemReactions: ReactionCollectorShopItemReaction[];
	pseudo: string;
	lng: Language;
}

/**
 * Build the "item recap" text shown above the confirmation buttons.
 */
function buildConfirmationItemRecap(
	display: ShopItemDisplay,
	isSingleUnit: boolean,
	data: ReactionCollectorShopData,
	itemReactions: ReactionCollectorShopItemReaction[],
	lng: Language
): TextDisplayBuilder {
	if (isSingleUnit) {
		return new TextDisplayBuilder().setContent(
			i18n.t("commands:shop.shopItemsDisplaySingle", {
				lng,
				name: display.fullName,
				price: itemReactions[0].price,
				currency: data.currency,
				remainingPotions: data.additionalShopData?.remainingPotions
			})
		);
	}
	const lines = itemReactions.map(reaction => i18n.t("commands:shop.shopItemsDisplayMultiple", {
		lng,
		name: display.fullName,
		amount: reaction.amount,
		price: reaction.price,
		currency: data.currency
	}));
	return new TextDisplayBuilder().setContent(lines.join("\n"));
}

/**
 * Build the warning info block describing what the item does once purchased.
 */
function buildConfirmationInfo(
	data: ReactionCollectorShopData,
	itemReactions: ReactionCollectorShopItemReaction[],
	lng: Language
): TextDisplayBuilder {
	return new TextDisplayBuilder().setContent(
		`${CrowniclesIcons.collectors.warning} ${i18n.t(
			`commands:shop.shopItems.${shopItemTypeToId(itemReactions[0].shopItemId)}.info`,
			{
				lng,
				kingsMoneyAmount: data.additionalShopData?.gemToMoneyRatio,
				thousandPoints: Constants.MISSION_SHOP.THOUSAND_POINTS
			}
		)}`
	);
}

/**
 * Build the action row for the confirmation view: either a single confirm button (single
 * unit items) or one button per amount, always followed by a cancel button.
 */
function buildConfirmationActionRow(
	itemReactions: ReactionCollectorShopItemReaction[],
	isSingleUnit: boolean,
	data: ReactionCollectorShopData,
	lng: Language
): ActionRowBuilder<ButtonBuilder> {
	const actionRow = new ActionRowBuilder<ButtonBuilder>();
	const itemIdStr = shopItemTypeToId(itemReactions[0].shopItemId);
	if (isSingleUnit) {
		actionRow.addComponents(
			new ButtonBuilder()
				.setCustomId(`${CITY_SHOP_CUSTOM_IDS.AMOUNT_PREFIX}${itemIdStr}_${itemReactions[0].amount}`)
				.setEmoji(CrowniclesIcons.collectors.accept)
				.setLabel(i18n.t("commands:shop.v2.confirmButton", { lng }))
				.setStyle(ButtonStyle.Success)
		);
	}
	else {
		for (const reaction of itemReactions) {
			actionRow.addComponents(
				new ButtonBuilder()
					.setCustomId(`${CITY_SHOP_CUSTOM_IDS.AMOUNT_PREFIX}${itemIdStr}_${reaction.amount}`)
					.setLabel(i18n.t("commands:shop.v2.amountButton", {
						lng,
						amount: reaction.amount,
						price: reaction.price,
						currency: data.currency
					}))
					.setStyle(ButtonStyle.Primary)
			);
		}
	}
	actionRow.addComponents(
		new ButtonBuilder()
			.setCustomId(CITY_SHOP_CUSTOM_IDS.CANCEL_PURCHASE)
			.setEmoji(CrowniclesIcons.collectors.refuse)
			.setLabel(i18n.t("commands:shop.v2.cancelButton", { lng }))
			.setStyle(ButtonStyle.Secondary)
	);
	return actionRow;
}

/**
 * Confirmation view shown after a player clicks "Buy" on an item. Renders the item
 * recap with its informational text, then either a single confirm button (when the
 * item has a unique amount) or one button per amount (e.g. wood bundles).
 */
export function buildShopConfirmationContainer(args: ConfirmationViewArgs): ContainerBuilder {
	const {
		data, itemReactions, pseudo, lng
	} = args;
	const display = buildItemDisplay(data, itemReactions, lng);
	const isSingleUnit = display.amounts.length === 1 && display.amounts[0] === 1;
	const container = new ContainerBuilder();

	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			`### ${i18n.t(
				isSingleUnit ? "commands:shop.shopConfirmationTitle" : "commands:shop.shopConfirmationTitleMultiple",
				{
					lng,
					pseudo: escapeUsername(pseudo)
				}
			)}`
		)
	);

	container.addTextDisplayComponents(buildConfirmationItemRecap(display, isSingleUnit, data, itemReactions, lng));
	container.addTextDisplayComponents(buildConfirmationInfo(data, itemReactions, lng));

	container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			i18n.t("commands:shop.currentMoney", {
				lng,
				money: data.availableCurrency,
				currency: data.currency
			})
		)
	);

	container.addActionRowComponents(buildConfirmationActionRow(itemReactions, isSingleUnit, data, lng));

	return container;
}

/**
 * Disable every button inside a top-level component of the container.
 */
function disableButtonsInComponent(component: unknown): void {
	if (component instanceof ActionRowBuilder) {
		for (const child of component.components) {
			if (child instanceof ButtonBuilder) {
				child.setDisabled(true);
			}
		}
		return;
	}
	if (component instanceof SectionBuilder && component.accessory instanceof ButtonBuilder) {
		component.accessory.setDisabled(true);
	}
}

/**
 * Disable every button inside the given container in-place. Used to mark the message
 * as inert when the collector ends or when Core finalizes the transaction.
 */
export function disableContainerButtons(container: ContainerBuilder): void {
	for (const component of container.components) {
		disableButtonsInComponent(component);
	}
}
