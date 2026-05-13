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

/**
 * Separator between the item id and the amount inside an amount custom id.
 * Must not appear in any value returned by `shopItemTypeToId`. Using `|` instead
 * of `_` keeps the parsing robust even if a future item id contains underscores.
 */
const AMOUNT_ID_SEPARATOR = "|";

export function buildShopAmountCustomId(itemIdStr: string, amount: number): string {
	return `${CITY_SHOP_CUSTOM_IDS.AMOUNT_PREFIX}${itemIdStr}${AMOUNT_ID_SEPARATOR}${amount}`;
}

export function parseShopAmountCustomId(customId: string): {
	itemIdStr: string; amount: number;
} | null {
	if (!customId.startsWith(CITY_SHOP_CUSTOM_IDS.AMOUNT_PREFIX)) {
		return null;
	}
	const payload = customId.slice(CITY_SHOP_CUSTOM_IDS.AMOUNT_PREFIX.length);
	const sep = payload.indexOf(AMOUNT_ID_SEPARATOR);
	if (sep === -1) {
		return null;
	}
	const itemIdStr = payload.slice(0, sep);
	const amount = parseInt(payload.slice(sep + 1), 10);
	if (Number.isNaN(amount)) {
		return null;
	}
	return {
		itemIdStr, amount
	};
}

export type CityShopReactionsByItem = Map<ShopItemType, ReactionCollectorShopItemReaction[]>;

interface ShopItemDisplay {
	fullName: string;
	shortLabel: string;

	/**
	 * Price per single unit, derived from the smallest-amount reaction. For items
	 * that only expose a single bundle this is just `price`; for multi-bundle items
	 * (e.g. wood packs) this is the base unit price, NOT necessarily the best deal —
	 * larger bundles may offer a discount. Used purely as a display reference.
	 */
	baseUnitPrice: number;
	amounts: number[];

	/**
	 * `true` if the item is a single, non-stackable unit (no amount picker
	 * needed). Computed once in `buildItemDisplay` so both the main view and
	 * the confirmation view share the exact same rule.
	 */
	isSingleUnit: boolean;
}

type ItemLabels = Pick<ShopItemDisplay, "fullName" | "shortLabel">;

/**
 * Resolve the labels (full + short) for a shop item that needs item-specific
 * rendering (e.g. daily potion stats, plant tier names). Items not registered
 * here fall through to the generic i18n-based naming in `resolveItemLabels`.
 */
type ItemLabelResolver = (data: ReactionCollectorShopData, lng: Language) => ItemLabels;

/**
 * Order-preserving list of weekly plant tiers. Used both to register one
 * resolver per tier and to recover the tier index when querying
 * `additionalShopData.weeklyPlants` — without relying on the underlying enum
 * values being contiguous or sorted.
 */
const WEEKLY_PLANT_TIERS: readonly ShopItemType[] = [
	ShopItemType.WEEKLY_PLANT_TIER_1,
	ShopItemType.WEEKLY_PLANT_TIER_2,
	ShopItemType.WEEKLY_PLANT_TIER_3
];

function dailyPotionLabels(data: ReactionCollectorShopData, lng: Language): ItemLabels {
	/*
	 * Producer (`ReactionCollectorShop`) always sets `dailyPotion` when a
	 * daily-potion reaction is emitted; narrow once.
	 */
	const dailyPotion = data.additionalShopData.dailyPotion!;
	return {
		fullName: DisplayUtils.getItemDisplayWithStats(dailyPotion, lng),
		shortLabel: DisplayUtils.getSimpleItemDisplay({
			id: dailyPotion.id,
			category: dailyPotion.itemCategory
		}, lng)
	};
}

function weeklyPlantLabelsFor(itemId: ShopItemType, tierIndex: number): ItemLabelResolver {
	return (data, lng) => {
		const plantId = data.additionalShopData.weeklyPlants?.[tierIndex];
		const name = i18n.t(`commands:shop.shopItems.${shopItemTypeToId(itemId)}.name`, {
			lng, plantId
		});
		return {
			fullName: `**${name}**`,
			shortLabel: name
		};
	};
}

const ITEM_LABEL_RESOLVERS: ReadonlyMap<ShopItemType, ItemLabelResolver> = new Map([
	[ShopItemType.DAILY_POTION, dailyPotionLabels],
	...WEEKLY_PLANT_TIERS.map((itemId, tierIndex): [ShopItemType, ItemLabelResolver] => [itemId, weeklyPlantLabelsFor(itemId, tierIndex)])
]);

function resolveItemLabels(data: ReactionCollectorShopData, itemId: ShopItemType, lng: Language): ItemLabels {
	const resolver = ITEM_LABEL_RESOLVERS.get(itemId);
	if (resolver) {
		return resolver(data, lng);
	}
	const name = i18n.t(`commands:shop.shopItems.${shopItemTypeToId(itemId)}.name`, { lng });
	return {
		fullName: `**${name}**`,
		shortLabel: name
	};
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
 * Build the display info (labels, unit price, amounts) for a single shop item.
 * The labels themselves are resolved via the `ITEM_LABEL_RESOLVERS` registry —
 * this function only owns the price/amount derivation and the `isSingleUnit`
 * flag that drives the confirmation view branching.
 *
 * Exported for unit testing — not part of the public view-builder surface.
 */
export function buildItemDisplay(
	data: ReactionCollectorShopData,
	itemReactions: ReactionCollectorShopItemReaction[],
	lng: Language
): ShopItemDisplay {
	const itemId = itemReactions[0].shopItemId;
	const amounts = itemReactions.map(r => r.amount);

	/*
	 * `itemReactions` is non-empty (caller iterates a map populated from packet
	 * reactions), so reduce-without-seed is safe and lets us pick the smallest-
	 * amount reaction without resorting to a non-null assertion.
	 */
	const unitReaction = itemReactions.reduce((a, b) => a.amount <= b.amount ? a : b);
	const baseUnitPrice = unitReaction.price / unitReaction.amount;
	const isSingleUnit = amounts.length === 1 && amounts[0] === 1;

	return {
		...resolveItemLabels(data, itemId, lng),
		baseUnitPrice,
		amounts,
		isSingleUnit
	};
}

interface ItemSectionArgs {
	display: ShopItemDisplay;
	itemReactions: ReactionCollectorShopItemReaction[];
	data: ReactionCollectorShopData;
	lng: Language;
	disabled: boolean;
}

function buildItemSection(args: ItemSectionArgs): SectionBuilder {
	const {
		display, itemReactions, data, lng, disabled
	} = args;
	const priceLine = display.isSingleUnit
		? i18n.t("commands:shop.itemPrice", {
			lng,
			price: itemReactions[0].price,
			currency: data.currency
		})
		: i18n.t("commands:shop.itemPriceUnit", {
			lng,
			price: display.baseUnitPrice,
			currency: data.currency
		});

	return new SectionBuilder()
		.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(`${display.fullName}\n${priceLine}`)
		)
		.setButtonAccessory(
			new ButtonBuilder()
				.setCustomId(`${CITY_SHOP_CUSTOM_IDS.BUY_PREFIX}${shopItemTypeToId(itemReactions[0].shopItemId)}`)
				.setLabel(i18n.t("commands:shop.buyButton", { lng }))
				.setStyle(ButtonStyle.Primary)
				.setDisabled(disabled)
		);
}

interface MainShopViewArgs {
	data: ReactionCollectorShopData;
	reactionsByItem: CityShopReactionsByItem;
	pseudo: string;
	lng: Language;
	disabled?: boolean;
}

interface CategoryItem {
	itemId: ShopItemType;
	reactions: ReactionCollectorShopItemReaction[];
}

/**
 * Group items by their category id, preserving discovery order within each category.
 * Returning the reactions alongside the item id (instead of just ids) lets the
 * caller render a category block without re-querying `reactionsByItem`.
 */
function groupItemsByCategory(reactionsByItem: CityShopReactionsByItem): Map<string, CategoryItem[]> {
	const categoryToItems = new Map<string, CategoryItem[]>();
	for (const [itemId, reactions] of reactionsByItem) {
		const categoryId = reactions[0].shopCategoryId;
		const entry: CategoryItem = {
			itemId, reactions
		};
		const list = categoryToItems.get(categoryId);
		if (list) {
			list.push(entry);
		}
		else {
			categoryToItems.set(categoryId, [entry]);
		}
	}
	return categoryToItems;
}

interface CategoryBlockArgs {
	container: ContainerBuilder;
	categoryId: string;
	items: CategoryItem[];
	data: ReactionCollectorShopData;
	lng: Language;
	disabled: boolean;
}

/**
 * Append a category block (separator + title + per-item sections) to the container.
 */
function appendCategoryBlock(args: CategoryBlockArgs): void {
	const {
		container, categoryId, items, data, lng, disabled
	} = args;
	container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			`**${i18n.t(`commands:shop.shopCategories.${categoryId}`, {
				lng,
				count: data.additionalShopData.remainingPotions
			})}**`
		)
	);
	for (const {
		reactions: itemReactions
	} of items) {
		const display = buildItemDisplay(data, itemReactions, lng);
		container.addSectionComponents(buildItemSection({
			display, itemReactions, data, lng, disabled
		}));
	}
}

/**
 * Main shop view rendered as a container with header, item list and footer.
 * One section per item with a "buy" button accessory; a single close button at the bottom.
 */
export function buildShopMainContainer(args: MainShopViewArgs): ContainerBuilder {
	const {
		data, reactionsByItem, pseudo, lng, disabled = false
	} = args;
	const container = new ContainerBuilder();

	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(`### ${i18n.t("commands:shop.title", { lng })}`)
	);

	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			i18n.t("commands:shop.greeting", {
				lng,
				pseudo: escapeUsername(pseudo)
			})
		)
	);

	const categoryToItems = groupItemsByCategory(reactionsByItem);
	const sortedCategories = [...categoryToItems.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);

	for (const [categoryId, items] of sortedCategories) {
		appendCategoryBlock({
			container,
			categoryId,
			items,
			data,
			lng,
			disabled
		});
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
				.setDisabled(disabled)
		)
	);

	return container;
}

interface ConfirmationViewArgs {
	data: ReactionCollectorShopData;
	itemReactions: ReactionCollectorShopItemReaction[];
	pseudo: string;
	lng: Language;
	disabled?: boolean;
}

interface ConfirmationRecapArgs {
	display: ShopItemDisplay;
	data: ReactionCollectorShopData;
	itemReactions: ReactionCollectorShopItemReaction[];
	lng: Language;
}

/**
 * Build the "item recap" text shown above the confirmation buttons.
 */
function buildConfirmationItemRecap(args: ConfirmationRecapArgs): TextDisplayBuilder {
	const {
		display, data, itemReactions, lng
	} = args;
	if (display.isSingleUnit) {
		return new TextDisplayBuilder().setContent(
			i18n.t("commands:shop.shopItemsDisplaySingle", {
				lng,
				name: display.fullName,
				price: itemReactions[0].price,
				currency: data.currency,
				remainingPotions: data.additionalShopData.remainingPotions
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
				kingsMoneyAmount: data.additionalShopData.gemToMoneyRatio,
				thousandPoints: Constants.MISSION_SHOP.THOUSAND_POINTS
			}
		)}`
	);
}

/**
 * Build the action row for the confirmation view: either a single confirm button (single
 * unit items) or one button per amount, always followed by a cancel button.
 */
interface ConfirmationActionRowArgs {
	display: ShopItemDisplay;
	itemReactions: ReactionCollectorShopItemReaction[];
	data: ReactionCollectorShopData;
	lng: Language;
	disabled: boolean;
}

function buildConfirmationActionRow(args: ConfirmationActionRowArgs): ActionRowBuilder<ButtonBuilder> {
	const {
		display, itemReactions, data, lng, disabled
	} = args;
	const actionRow = new ActionRowBuilder<ButtonBuilder>();
	const itemIdStr = shopItemTypeToId(itemReactions[0].shopItemId);
	if (display.isSingleUnit) {
		actionRow.addComponents(
			new ButtonBuilder()
				.setCustomId(buildShopAmountCustomId(itemIdStr, itemReactions[0].amount))
				.setEmoji(CrowniclesIcons.collectors.accept)
				.setLabel(i18n.t("commands:shop.confirmButton", { lng }))
				.setStyle(ButtonStyle.Success)
				.setDisabled(disabled)
		);
	}
	else {
		for (const reaction of itemReactions) {
			actionRow.addComponents(
				new ButtonBuilder()
					.setCustomId(buildShopAmountCustomId(itemIdStr, reaction.amount))
					.setLabel(i18n.t("commands:shop.amountButton", {
						lng,
						amount: reaction.amount,
						price: reaction.price,
						currency: data.currency
					}))
					.setStyle(ButtonStyle.Primary)
					.setDisabled(disabled)
			);
		}
	}
	actionRow.addComponents(
		new ButtonBuilder()
			.setCustomId(CITY_SHOP_CUSTOM_IDS.CANCEL_PURCHASE)
			.setEmoji(CrowniclesIcons.collectors.refuse)
			.setLabel(i18n.t("commands:shop.cancelButton", { lng }))
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(disabled)
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
		data, itemReactions, pseudo, lng, disabled = false
	} = args;
	const display = buildItemDisplay(data, itemReactions, lng);
	const container = new ContainerBuilder();

	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			`### ${i18n.t(
				display.isSingleUnit ? "commands:shop.shopConfirmationTitle" : "commands:shop.shopConfirmationTitleMultiple",
				{
					lng,
					pseudo: escapeUsername(pseudo)
				}
			)}`
		)
	);

	container.addTextDisplayComponents(buildConfirmationItemRecap({
		display, data, itemReactions, lng
	}));
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

	container.addActionRowComponents(buildConfirmationActionRow({
		display, itemReactions, data, lng, disabled
	}));

	return container;
}
