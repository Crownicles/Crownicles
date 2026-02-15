import {
	ActionRowBuilder, ButtonBuilder, ButtonStyle,
	Message, parseEmoji, StringSelectMenuBuilder,
	StringSelectMenuInteraction
} from "discord.js";
import {
	ComponentInteraction,
	HomeFeatureHandler, HomeFeatureHandlerContext, HomeFeatureMenuOption
} from "../HomeMenuTypes";
import { CrowniclesNestedMenus } from "../../../../../messages/CrowniclesNestedMenus";
import i18n from "../../../../../translations/i18n";
import { DisplayUtils } from "../../../../../utils/DisplayUtils";
import { CrowniclesIcons } from "../../../../../../../Lib/src/CrowniclesIcons";
import { ItemCategory } from "../../../../../../../Lib/src/constants/ItemConstants";
import { Language } from "../../../../../../../Lib/src/Language";
import { HomeMenuIds } from "../HomeMenuConstants";
import {
	ChestSlotsPerCategory, getSlotCountForCategory
} from "../../../../../../../Lib/src/types/HomeFeatures";
import { MainItemDetails } from "../../../../../../../Lib/src/types/MainItemDetails";
import { ItemWithDetails } from "../../../../../../../Lib/src/types/ItemWithDetails";
import { MessageActionRowComponentBuilder } from "@discordjs/builders";
import { DiscordConstants } from "../../../../../DiscordConstants";
import { DiscordMQTT } from "../../../../../bot/DiscordMQTT";
import { makePacket } from "../../../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportHomeChestActionReq,
	CommandReportHomeChestActionRes
} from "../../../../../../../Lib/src/packets/commands/CommandReportPacket";
import { HomeConstants } from "../../../../../../../Lib/src/constants/HomeConstants";
import { CrowniclesEmbed } from "../../../../../messages/CrowniclesEmbed";
import { sendInteractionNotForYou } from "../../../../../utils/ErrorUtils";

const CATEGORY_INFO: {
	key: keyof ChestSlotsPerCategory; category: ItemCategory; translationKey: string;
}[] = [
	{
		key: "weapon", category: ItemCategory.WEAPON, translationKey: "weapons"
	},
	{
		key: "armor", category: ItemCategory.ARMOR, translationKey: "armors"
	},
	{
		key: "potion", category: ItemCategory.POTION, translationKey: "potions"
	},
	{
		key: "object", category: ItemCategory.OBJECT, translationKey: "objects"
	}
];

export class ChestFeatureHandler implements HomeFeatureHandler {
	public readonly featureId = "chest";

	private hasAnyChestSlots(ctx: HomeFeatureHandlerContext): boolean {
		const slots = ctx.homeData.features.chestSlots;
		return slots.weapon + slots.armor + slots.potion + slots.object > 0;
	}

	public isAvailable(ctx: HomeFeatureHandlerContext): boolean {
		return this.hasAnyChestSlots(ctx);
	}

	public getMenuOption(ctx: HomeFeatureHandlerContext): HomeFeatureMenuOption | null {
		if (!this.isAvailable(ctx)) {
			return null;
		}

		const chest = ctx.homeData.chest;
		const filledCount = chest?.chestItems.length ?? 0;
		const slots = ctx.homeData.features.chestSlots;
		const totalSlots = slots.weapon + slots.armor + slots.potion + slots.object;

		return {
			label: i18n.t("commands:report.city.homes.chest.menuLabel", { lng: ctx.lng }),
			description: i18n.t("commands:report.city.homes.chest.menuDescription", {
				lng: ctx.lng, filled: filledCount, total: totalSlots
			}),
			emoji: CrowniclesIcons.city.homeUpgrades.chest,
			value: HomeMenuIds.CHEST_MENU
		};
	}

	public getDescriptionLines(ctx: HomeFeatureHandlerContext): string[] {
		if (!this.isAvailable(ctx)) {
			return [];
		}
		return [i18n.t("commands:report.city.homes.chest.available", { lng: ctx.lng })];
	}

	public async handleFeatureSelection(
		_ctx: HomeFeatureHandlerContext,
		selectInteraction: StringSelectMenuInteraction,
		nestedMenus: CrowniclesNestedMenus
	): Promise<void> {
		await selectInteraction.deferUpdate();
		await nestedMenus.changeMenu(HomeMenuIds.CHEST_MENU);
	}

	public async handleSubMenuSelection(
		ctx: HomeFeatureHandlerContext,
		selectedValue: string,
		componentInteraction: ComponentInteraction,
		nestedMenus: CrowniclesNestedMenus
	): Promise<boolean> {
		// Exact match navigation
		const navigationTargets: Record<string, string> = {
			[HomeMenuIds.BACK_TO_HOME]: HomeMenuIds.HOME_MENU,
			[HomeMenuIds.CHEST_BACK_TO_CATEGORIES]: HomeMenuIds.CHEST_MENU
		};

		if (navigationTargets[selectedValue]) {
			await componentInteraction.deferUpdate();
			await nestedMenus.changeMenu(navigationTargets[selectedValue]);
			return true;
		}

		// Prefix-based action routing
		return this.handlePrefixAction(ctx, selectedValue, componentInteraction, nestedMenus);
	}

	private async handlePrefixAction(
		ctx: HomeFeatureHandlerContext,
		selectedValue: string,
		componentInteraction: ComponentInteraction,
		nestedMenus: CrowniclesNestedMenus
	): Promise<boolean> {
		const actionRoutes: {
			prefix: string; action: string;
		}[] = [
			{
				prefix: HomeMenuIds.CHEST_DEPOSIT_PREFIX, action: HomeConstants.CHEST_ACTIONS.DEPOSIT
			},
			{
				prefix: HomeMenuIds.CHEST_WITHDRAW_PREFIX, action: HomeConstants.CHEST_ACTIONS.WITHDRAW
			},
			{
				prefix: HomeMenuIds.CHEST_SWAP_TARGET_PREFIX, action: HomeConstants.CHEST_ACTIONS.SWAP
			}
		];

		for (const route of actionRoutes) {
			if (selectedValue.startsWith(route.prefix)) {
				await this.handleChestActionByPrefix({
					ctx, selectedValue, componentInteraction, nestedMenus,
					prefix: route.prefix, action: route.action
				});
				return true;
			}
		}

		if (selectedValue.startsWith(HomeMenuIds.CHEST_CATEGORY_PREFIX)) {
			const categoryIndex = parseInt(selectedValue.replace(HomeMenuIds.CHEST_CATEGORY_PREFIX, ""), 10);
			if (!Number.isNaN(categoryIndex)) {
				await this.showCategoryDetail(ctx, categoryIndex, componentInteraction, nestedMenus);
				return true;
			}
		}

		if (selectedValue.startsWith(HomeMenuIds.CHEST_SWAP_SELECT_PREFIX)) {
			await this.handleSwapSelect(ctx, selectedValue, componentInteraction, nestedMenus);
			return true;
		}

		if (selectedValue.startsWith(HomeMenuIds.CHEST_BACK_TO_DETAIL_PREFIX)) {
			await componentInteraction.deferUpdate();
			const categoryIndex = parseInt(selectedValue.replace(HomeMenuIds.CHEST_BACK_TO_DETAIL_PREFIX, ""), 10);
			await nestedMenus.changeMenu(`${HomeMenuIds.CHEST_CATEGORY_DETAIL_PREFIX}${categoryIndex}`);
			return true;
		}

		return false;
	}

	/**
	 * Add a button to the last row, creating a new row if the current one is full.
	 */
	private addButtonToRow(rows: ActionRowBuilder<ButtonBuilder>[], button: ButtonBuilder): void {
		if (rows[rows.length - 1].components.length >= DiscordConstants.MAX_BUTTONS_PER_ROW) {
			rows.push(new ActionRowBuilder<ButtonBuilder>());
		}
		rows[rows.length - 1].addComponents(button);
	}

	/**
	 * Build a button for an item action (deposit/withdraw/swap).
	 */
	private buildItemButton(emoteIndex: number, customId: string, disabled?: boolean): ButtonBuilder {
		return new ButtonBuilder()
			.setEmoji(parseEmoji(CrowniclesIcons.choiceEmotes[emoteIndex])!)
			.setCustomId(customId)
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(disabled ?? false);
	}

	/**
	 * Add a section of items with buttons.
	 * Returns the updated emote index after adding all items.
	 */
	private addItemSectionWithButtons(params: {
		items: {
			slot: number; details: ItemWithDetails;
		}[];
		category: ItemCategory;
		rows: ActionRowBuilder<ButtonBuilder>[];
		emoteIndex: number;
		customIdPrefix: string;
		disabled: boolean;
		lng: Language;
	}): {
		description: string; emoteIndex: number;
	} {
		let description = "";
		let { emoteIndex } = params;

		for (const item of params.items) {
			if (emoteIndex >= CrowniclesIcons.choiceEmotes.length) {
				break;
			}

			const details = this.withUnlimitedMaxValue(item.details, params.category);
			const itemDisplay = DisplayUtils.getItemDisplayWithStats(details, params.lng);
			description += `\n${CrowniclesIcons.choiceEmotes[emoteIndex]} - ${itemDisplay}`;

			const button = this.buildItemButton(
				emoteIndex,
				`${params.customIdPrefix}${params.category}_${item.slot}`,
				params.disabled
			);
			this.addButtonToRow(params.rows, button);
			emoteIndex++;
		}

		return {
			description, emoteIndex
		};
	}

	/**
	 * Parse action params from a customId string like "PREFIX_{category}_{slot}" or "PREFIX_{category}_{slot}_{chestSlot}"
	 */
	private parseChestActionParams(selectedValue: string, prefix: string): {
		category: ItemCategory; slot: number; chestSlot?: number;
	} {
		const parts = selectedValue.replace(prefix, "").split("_");
		return {
			category: parseInt(parts[0], 10) as ItemCategory,
			slot: parseInt(parts[1], 10),
			chestSlot: parts[2] !== undefined ? parseInt(parts[2], 10) : undefined
		};
	}

	private async showCategoryDetail(
		ctx: HomeFeatureHandlerContext,
		categoryIndex: number,
		componentInteraction: ComponentInteraction,
		nestedMenus: CrowniclesNestedMenus
	): Promise<void> {
		const catInfo = CATEGORY_INFO[categoryIndex];
		if (!catInfo) {
			await componentInteraction.deferUpdate();
			return;
		}

		if (!ctx.homeData.chest) {
			await componentInteraction.deferUpdate();
			return;
		}

		await componentInteraction.deferUpdate();
		await this.registerCategoryMenu(ctx, categoryIndex, nestedMenus);
		await nestedMenus.changeMenu(`${HomeMenuIds.CHEST_CATEGORY_DETAIL_PREFIX}${categoryIndex}`);
	}

	/**
	 * Rebuild the category detail menu in-place after a chest action.
	 * Called from the AsyncPacketSender callback.
	 */
	private async rebuildCategoryDetailMenu(
		ctx: HomeFeatureHandlerContext,
		categoryIndex: number,
		nestedMenus: CrowniclesNestedMenus
	): Promise<void> {
		await this.registerCategoryMenu(ctx, categoryIndex, nestedMenus);
		await nestedMenus.changeMenu(`${HomeMenuIds.CHEST_CATEGORY_DETAIL_PREFIX}${categoryIndex}`);
	}

	/**
	 * Re-register the chest categories menu (HOME_CHEST_MENU) with updated item counts.
	 * Called after a deposit/withdraw to keep category buttons in sync.
	 */
	private async refreshChestCategoriesMenu(
		ctx: HomeFeatureHandlerContext,
		nestedMenus: CrowniclesNestedMenus
	): Promise<void> {
		nestedMenus.registerMenu(HomeMenuIds.CHEST_MENU, {
			embed: new CrowniclesEmbed()
				.formatAuthor(this.getSubMenuTitle(ctx, ctx.pseudo), ctx.user)
				.setDescription(this.getSubMenuDescription(ctx)),
			components: this.getSubMenuComponents(ctx),
			createCollector: this.createChestCollector(ctx)
		});
	}

	/**
	 * Create a collector that delegates button interactions to handleSubMenuSelection.
	 */
	private createChestCollector(ctx: HomeFeatureHandlerContext) {
		return (menus: CrowniclesNestedMenus, message: Message) => {
			const collector = message.createMessageComponentCollector({ time: ctx.collectorTime });
			collector.on("collect", async interaction => {
				if (interaction.user.id !== ctx.user.id) {
					await sendInteractionNotForYou(interaction.user, interaction, ctx.lng);
					return;
				}

				if (interaction.isButton()) {
					await this.handleSubMenuSelection(ctx, interaction.customId, interaction, menus);
				}
			});
			return collector;
		};
	}

	/**
	 * Build and register the category detail menu with its embed, buttons and collector.
	 */
	private async registerCategoryMenu(
		ctx: HomeFeatureHandlerContext,
		categoryIndex: number,
		nestedMenus: CrowniclesNestedMenus
	): Promise<void> {
		const catInfo = CATEGORY_INFO[categoryIndex];
		const chest = ctx.homeData.chest!;

		const categoryChestItems = chest.chestItems.filter(item => item.category === catInfo.category);
		const categoryDepositableItems = chest.depositableItems.filter(item => item.category === catInfo.category);
		const maxSlots = getSlotCountForCategory(chest.slotsPerCategory, catInfo.category);
		const hasEmptySlots = categoryChestItems.length < maxSlots;

		const menuId = `${HomeMenuIds.CHEST_CATEGORY_DETAIL_PREFIX}${categoryIndex}`;

		// Build description header and inventory info
		const description = this.buildCategoryMenuContent(
			ctx, catInfo, categoryChestItems, categoryDepositableItems, maxSlots, hasEmptySlots
		);

		nestedMenus.registerMenu(menuId, {
			embed: new CrowniclesEmbed()
				.formatAuthor(
					i18n.t("commands:report.city.homes.chest.title", {
						lng: ctx.lng, pseudo: ctx.pseudo
					}),
					ctx.user
				)
				.setDescription(description.text),
			components: description.rows,
			createCollector: this.createChestCollector(ctx)
		});
	}

	/**
	 * Build the full content (description + buttons) for a category menu.
	 */
	private buildCategoryMenuContent(
		ctx: HomeFeatureHandlerContext,
		catInfo: typeof CATEGORY_INFO[number],
		categoryChestItems: {
			slot: number; details: ItemWithDetails;
		}[],
		categoryDepositableItems: {
			slot: number; details: ItemWithDetails;
		}[],
		maxSlots: number,
		hasEmptySlots: boolean
	): {
		text: string; rows: ActionRowBuilder<ButtonBuilder>[];
	} {
		const chest = ctx.homeData.chest!;
		const rows: ActionRowBuilder<ButtonBuilder>[] = [new ActionRowBuilder<ButtonBuilder>()];

		// Build header
		let text = i18n.t("commands:report.city.homes.chest.categoryHeader", {
			lng: ctx.lng,
			category: i18n.t(`items:categories.${catInfo.translationKey}`, { lng: ctx.lng }),
			filled: categoryChestItems.length,
			total: maxSlots
		});

		// Inventory capacity info
		const activeItem = categoryDepositableItems.find(item => item.slot === 0);
		const backupCount = categoryDepositableItems.filter(item => item.slot > 0).length;
		const maxBackup = getSlotCountForCategory(chest.inventoryCapacity, catInfo.category);
		const isInventoryFull = activeItem !== undefined && backupCount >= maxBackup;

		text += `\n${i18n.t("commands:report.city.homes.chest.inventoryInfo", {
			lng: ctx.lng,
			equipped: activeItem ? CrowniclesIcons.collectors.accept : CrowniclesIcons.collectors.refuse,
			backupCount,
			maxBackup
		})}`;

		// Warning banners
		text += this.buildWarningBanners(ctx.lng, hasEmptySlots, isInventoryFull);

		// Build sections based on state
		const bothFull = !hasEmptySlots && isInventoryFull;
		text += this.buildCategorySections({
			ctx,
			catInfo,
			chestItems: categoryChestItems,
			depositableItems: categoryDepositableItems,
			hasEmptySlots,
			isInventoryFull,
			bothFull,
			rows
		});

		// Back button
		this.addButtonToRow(rows, new ButtonBuilder()
			.setEmoji(parseEmoji(CrowniclesIcons.collectors.refuse)!)
			.setCustomId(HomeMenuIds.CHEST_BACK_TO_CATEGORIES)
			.setStyle(ButtonStyle.Secondary));

		return {
			text, rows
		};
	}

	/**
	 * Build warning banners for chest/inventory full states.
	 */
	private buildWarningBanners(lng: Language, hasEmptySlots: boolean, isInventoryFull: boolean): string {
		let text = "";
		if (!hasEmptySlots) {
			text += `\n\n${CrowniclesIcons.collectors.warning} *${i18n.t("commands:report.city.homes.chest.chestFull", { lng })}*`;
		}
		if (isInventoryFull) {
			text += `\n${CrowniclesIcons.collectors.warning} *${i18n.t("commands:report.city.homes.chest.inventoryFullLabel", { lng })}*`;
		}
		return text;
	}

	/**
	 * Build deposit/withdraw/swap sections with buttons.
	 */
	private buildCategorySections(params: {
		ctx: HomeFeatureHandlerContext;
		catInfo: typeof CATEGORY_INFO[number];
		chestItems: {
			slot: number; details: ItemWithDetails;
		}[];
		depositableItems: {
			slot: number; details: ItemWithDetails;
		}[];
		hasEmptySlots: boolean;
		isInventoryFull: boolean;
		bothFull: boolean;
		rows: ActionRowBuilder<ButtonBuilder>[];
	}): string {
		const {
			ctx, catInfo, chestItems, depositableItems, hasEmptySlots, isInventoryFull, bothFull, rows
		} = params;
		let text = "";
		let emoteIndex = 0;

		if (bothFull && chestItems.length > 0 && depositableItems.length > 0) {
			// Swap mode: only show inventory items to initiate swap
			text += `\n\n${i18n.t("commands:report.city.homes.chest.swapSection", { lng: ctx.lng })}`;
			const result = this.addItemSectionWithButtons({
				items: depositableItems,
				category: catInfo.category,
				rows,
				emoteIndex,
				customIdPrefix: HomeMenuIds.CHEST_SWAP_SELECT_PREFIX,
				disabled: false,
				lng: ctx.lng
			});
			text += result.description;
		}
		else {
			// Normal mode: deposit + withdraw sections
			if (depositableItems.length > 0) {
				text += `\n\n${i18n.t("commands:report.city.homes.chest.depositSection", { lng: ctx.lng })}`;
				const result = this.addItemSectionWithButtons({
					items: depositableItems,
					category: catInfo.category,
					rows,
					emoteIndex,
					customIdPrefix: HomeMenuIds.CHEST_DEPOSIT_PREFIX,
					disabled: !hasEmptySlots,
					lng: ctx.lng
				});
				text += result.description;
				emoteIndex = result.emoteIndex;
			}

			if (chestItems.length > 0) {
				text += `\n\n${i18n.t("commands:report.city.homes.chest.withdrawSection", { lng: ctx.lng })}`;
				const result = this.addItemSectionWithButtons({
					items: chestItems,
					category: catInfo.category,
					rows,
					emoteIndex,
					customIdPrefix: HomeMenuIds.CHEST_WITHDRAW_PREFIX,
					disabled: isInventoryFull,
					lng: ctx.lng
				});
				text += result.description;
			}
		}

		if (emoteIndex === 0 && chestItems.length === 0 && depositableItems.length === 0) {
			text += `\n\n${i18n.t("commands:report.city.homes.chest.noStoredItems", { lng: ctx.lng })}`;
		}

		return text;
	}

	private async handleChestActionByPrefix({ ctx, selectedValue, componentInteraction, nestedMenus, prefix, action }: {
		ctx: HomeFeatureHandlerContext;
		selectedValue: string;
		componentInteraction: ComponentInteraction;
		nestedMenus: CrowniclesNestedMenus;
		prefix: string;
		action: string;
	}): Promise<void> {
		const params = this.parseChestActionParams(selectedValue, prefix);
		await componentInteraction.deferUpdate();
		await this.sendChestAction({
			ctx,
			action,
			slot: params.slot,
			category: params.category,
			nestedMenus,
			chestSlot: params.chestSlot
		});
	}

	/**
	 * Handle step 1 of swap: player selected an inventory item to swap.
	 * Open a sub-menu showing chest items as targets.
	 */
	private async handleSwapSelect(
		ctx: HomeFeatureHandlerContext,
		selectedValue: string,
		componentInteraction: ComponentInteraction,
		nestedMenus: CrowniclesNestedMenus
	): Promise<void> {
		const {
			category, slot: inventorySlot
		} = this.parseChestActionParams(selectedValue, HomeMenuIds.CHEST_SWAP_SELECT_PREFIX);
		await componentInteraction.deferUpdate();

		const categoryIndex = CATEGORY_INFO.findIndex(c => c.category === category);
		if (categoryIndex === -1) {
			return;
		}

		await this.registerSwapTargetMenu(ctx, categoryIndex, inventorySlot, nestedMenus);
		await nestedMenus.changeMenu(`${HomeMenuIds.CHEST_SWAP_MENU_PREFIX}${categoryIndex}_${inventorySlot}`);
	}

	/**
	 * Build and register the swap target selection sub-menu.
	 * Shows chest items to swap with the selected inventory item.
	 */
	private async registerSwapTargetMenu(
		ctx: HomeFeatureHandlerContext,
		categoryIndex: number,
		inventorySlot: number,
		nestedMenus: CrowniclesNestedMenus
	): Promise<void> {
		const catInfo = CATEGORY_INFO[categoryIndex];
		const chest = ctx.homeData.chest!;

		const categoryChestItems = chest.chestItems.filter(item => item.category === catInfo.category);
		const categoryDepositableItems = chest.depositableItems.filter(item => item.category === catInfo.category);
		const selectedItem = categoryDepositableItems.find(item => item.slot === inventorySlot);
		const menuId = `${HomeMenuIds.CHEST_SWAP_MENU_PREFIX}${categoryIndex}_${inventorySlot}`;

		let description = i18n.t("commands:report.city.homes.chest.swapHeader", {
			lng: ctx.lng,
			item: selectedItem
				? DisplayUtils.getItemDisplayWithStats(this.withUnlimitedMaxValue(selectedItem.details, catInfo.category), ctx.lng)
				: "?"
		});
		description += "\n";

		const rows: ActionRowBuilder<ButtonBuilder>[] = [new ActionRowBuilder<ButtonBuilder>()];

		// Build swap target buttons using helper
		for (let j = 0; j < categoryChestItems.length && j < CrowniclesIcons.choiceEmotes.length; j++) {
			const chestItem = categoryChestItems[j];
			const details = this.withUnlimitedMaxValue(chestItem.details, catInfo.category);
			description += `\n${CrowniclesIcons.choiceEmotes[j]} - ${DisplayUtils.getItemDisplayWithStats(details, ctx.lng)}`;

			const button = this.buildItemButton(j, `${HomeMenuIds.CHEST_SWAP_TARGET_PREFIX}${catInfo.category}_${inventorySlot}_${chestItem.slot}`);
			this.addButtonToRow(rows, button);
		}

		// Back button
		this.addButtonToRow(rows, new ButtonBuilder()
			.setEmoji(parseEmoji(CrowniclesIcons.collectors.refuse)!)
			.setCustomId(`${HomeMenuIds.CHEST_BACK_TO_DETAIL_PREFIX}${categoryIndex}`)
			.setStyle(ButtonStyle.Secondary));

		nestedMenus.registerMenu(menuId, {
			embed: new CrowniclesEmbed()
				.formatAuthor(
					i18n.t("commands:report.city.homes.chest.title", {
						lng: ctx.lng, pseudo: ctx.pseudo
					}),
					ctx.user
				)
				.setDescription(description),
			components: rows,
			createCollector: this.createChestCollector(ctx)
		});
	}

	/**
	 * Send a chest action (deposit/withdraw/swap) directly to Core via AsyncPacketSender
	 * and update the menu in-place with the refreshed data.
	 */
	private async sendChestAction(params: {
		ctx: HomeFeatureHandlerContext;
		action: string;
		slot: number;
		category: ItemCategory;
		nestedMenus: CrowniclesNestedMenus;
		chestSlot?: number;
	}): Promise<void> {
		const {
			ctx, action, slot, category, nestedMenus, chestSlot
		} = params;

		await DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse(
			ctx.context,
			makePacket(CommandReportHomeChestActionReq, {
				action, slot, itemCategory: category, chestSlot: chestSlot ?? -1
			}),
			async (_responseContext, _packetName, responsePacket) => {
				const response = responsePacket as unknown as CommandReportHomeChestActionRes;

				if (!response.success) {
					return;
				}

				// Update chest data in context with fresh data from Core
				if (ctx.homeData.chest) {
					ctx.homeData.chest.chestItems = response.chestItems;
					ctx.homeData.chest.depositableItems = response.depositableItems;
					ctx.homeData.chest.slotsPerCategory = response.slotsPerCategory;
					ctx.homeData.chest.inventoryCapacity = response.inventoryCapacity;
				}

				// Re-register the chest categories menu with updated counts
				await this.refreshChestCategoriesMenu(ctx, nestedMenus);

				// Rebuild and refresh the category detail view in-place
				const categoryIndex = CATEGORY_INFO.findIndex(c => c.category === category);
				if (categoryIndex !== -1) {
					await this.rebuildCategoryDetailMenu(ctx, categoryIndex, nestedMenus);
				}
			}
		);
	}

	public addSubMenuOptions(_ctx: HomeFeatureHandlerContext, _selectMenu: StringSelectMenuBuilder): void {
		// Chest uses custom button components instead of select menu options
	}

	public getSubMenuComponents(ctx: HomeFeatureHandlerContext): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
		const chest = ctx.homeData.chest;
		if (!chest) {
			return [];
		}

		const buttons: ButtonBuilder[] = [];

		for (let i = 0; i < CATEGORY_INFO.length; i++) {
			const catInfo = CATEGORY_INFO[i];
			const maxSlots = getSlotCountForCategory(chest.slotsPerCategory, catInfo.category);
			if (maxSlots === 0) {
				continue;
			}
			const filledCount = chest.chestItems.filter(item => item.category === catInfo.category).length;
			buttons.push(
				new ButtonBuilder()
					.setCustomId(`${HomeMenuIds.CHEST_CATEGORY_PREFIX}${i}`)
					.setLabel(`${i18n.t(`items:categories.${catInfo.translationKey}`, { lng: ctx.lng })} (${filledCount}/${maxSlots})`)
					.setEmoji(CrowniclesIcons.itemCategories[catInfo.category])
					.setStyle(filledCount > 0 ? ButtonStyle.Primary : ButtonStyle.Secondary)
			);
		}

		buttons.push(
			new ButtonBuilder()
				.setCustomId(HomeMenuIds.BACK_TO_HOME)
				.setLabel(i18n.t("commands:report.city.homes.backToHome", { lng: ctx.lng }))
				.setEmoji(CrowniclesIcons.collectors.back)
				.setStyle(ButtonStyle.Danger)
		);

		return [new ActionRowBuilder<ButtonBuilder>().addComponents(buttons)];
	}

	/**
	 * Clone item details with unlimited maxValue for display purposes.
	 * Only applies to MainItemDetails (weapons/armors); support items are returned as-is.
	 */
	private withUnlimitedMaxValue(details: ItemWithDetails, category: ItemCategory): ItemWithDetails {
		if (category === ItemCategory.WEAPON || category === ItemCategory.ARMOR) {
			const mainDetails = details as MainItemDetails;
			return {
				...mainDetails,
				attack: {
					...mainDetails.attack, maxValue: Infinity
				},
				defense: {
					...mainDetails.defense, maxValue: Infinity
				},
				speed: {
					...mainDetails.speed, maxValue: Infinity
				}
			};
		}
		return details;
	}

	public getSubMenuDescription(ctx: HomeFeatureHandlerContext): string {
		const chest = ctx.homeData.chest;
		const hasItems = chest && chest.chestItems.length > 0;

		return hasItems
			? i18n.t("commands:report.city.homes.chest.descriptionWithItems", { lng: ctx.lng })
			: i18n.t("commands:report.city.homes.chest.descriptionEmpty", { lng: ctx.lng });
	}

	public getSubMenuPlaceholder(ctx: HomeFeatureHandlerContext): string {
		return i18n.t("commands:report.city.homes.chest.placeholder", { lng: ctx.lng });
	}

	public getSubMenuTitle(ctx: HomeFeatureHandlerContext, pseudo: string): string {
		return i18n.t("commands:report.city.homes.chest.title", {
			lng: ctx.lng, pseudo
		});
	}
}
