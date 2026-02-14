import {
	ActionRowBuilder, ButtonBuilder, ButtonStyle,
	parseEmoji, StringSelectMenuBuilder, StringSelectMenuInteraction
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
import { HomeMenuIds } from "../HomeMenuConstants";
import { ChestSlotsPerCategory } from "../../../../../../../Lib/src/types/HomeFeatures";
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

const CATEGORY_INFO: {
	key: keyof ChestSlotsPerCategory; category: ItemCategory; translationKey: string; emoji: string;
}[] = [
	{
		key: "weapon", category: ItemCategory.WEAPON, translationKey: "weapons", emoji: "⚔️"
	},
	{
		key: "armor", category: ItemCategory.ARMOR, translationKey: "armors", emoji: "🛡️"
	},
	{
		key: "potion", category: ItemCategory.POTION, translationKey: "potions", emoji: "🧪"
	},
	{
		key: "object", category: ItemCategory.OBJECT, translationKey: "objects", emoji: "📦"
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
		if (selectedValue === HomeMenuIds.BACK_TO_HOME) {
			await componentInteraction.deferUpdate();
			await nestedMenus.changeMenu(HomeMenuIds.HOME_MENU);
			return true;
		}

		if (selectedValue === HomeMenuIds.CHEST_BACK_TO_CATEGORIES) {
			await componentInteraction.deferUpdate();
			await nestedMenus.changeMenu(HomeMenuIds.CHEST_MENU);
			return true;
		}

		if (selectedValue.startsWith(HomeMenuIds.CHEST_CATEGORY_PREFIX)) {
			const categoryIndex = parseInt(selectedValue.replace(HomeMenuIds.CHEST_CATEGORY_PREFIX, ""), 10);
			if (!Number.isNaN(categoryIndex)) {
				await this.showCategoryDetail(ctx, categoryIndex, componentInteraction, nestedMenus);
				return true;
			}
		}

		if (selectedValue.startsWith(HomeMenuIds.CHEST_DEPOSIT_PREFIX)) {
			await this.handleDeposit(ctx, selectedValue, componentInteraction, nestedMenus);
			return true;
		}

		if (selectedValue.startsWith(HomeMenuIds.CHEST_WITHDRAW_PREFIX)) {
			await this.handleWithdraw(ctx, selectedValue, componentInteraction, nestedMenus);
			return true;
		}

		if (selectedValue.startsWith(HomeMenuIds.CHEST_SWAP_SELECT_PREFIX)) {
			await this.handleSwapSelect(ctx, selectedValue, componentInteraction, nestedMenus);
			return true;
		}

		if (selectedValue.startsWith(HomeMenuIds.CHEST_SWAP_TARGET_PREFIX)) {
			await this.handleSwapTarget(ctx, selectedValue, componentInteraction, nestedMenus);
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

	private getCategorySlotCount(slotsPerCategory: ChestSlotsPerCategory, category: ItemCategory): number {
		switch (category) {
			case ItemCategory.WEAPON: return slotsPerCategory.weapon;
			case ItemCategory.ARMOR: return slotsPerCategory.armor;
			case ItemCategory.POTION: return slotsPerCategory.potion;
			case ItemCategory.OBJECT: return slotsPerCategory.object;
			default: return 0;
		}
	}

	private static readonly CHOICE_EMOTES = [
		"1⃣",
		"2⃣",
		"3⃣",
		"4⃣",
		"5⃣",
		"6⃣",
		"7⃣",
		"8⃣",
		"9⃣"
	];

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
		const { CrowniclesEmbed } = await import("../../../../../messages/CrowniclesEmbed");

		nestedMenus.registerMenu(HomeMenuIds.CHEST_MENU, {
			embed: new CrowniclesEmbed()
				.formatAuthor(this.getSubMenuTitle(ctx, ctx.pseudo), ctx.user)
				.setDescription(this.getSubMenuDescription(ctx)),
			components: this.getSubMenuComponents(ctx),
			createCollector: (menus, message) => {
				const collector = message.createMessageComponentCollector({ time: ctx.collectorTime });
				collector.on("collect", async interaction => {
					if (interaction.user.id !== ctx.user.id) {
						const { sendInteractionNotForYou } = await import("../../../../../utils/ErrorUtils");
						await sendInteractionNotForYou(interaction.user, interaction, ctx.lng);
						return;
					}

					if (interaction.isButton()) {
						await this.handleSubMenuSelection(ctx, interaction.customId, interaction, menus);
					}
				});
				return collector;
			}
		});
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
		const maxSlots = this.getCategorySlotCount(chest.slotsPerCategory, catInfo.category);
		const hasEmptySlots = categoryChestItems.length < maxSlots;

		const menuId = `${HomeMenuIds.CHEST_CATEGORY_DETAIL_PREFIX}${categoryIndex}`;

		// Build description header
		let description = i18n.t("commands:report.city.homes.chest.categoryHeader", {
			lng: ctx.lng,
			category: i18n.t(`commands:report.city.homes.chest.categories.${catInfo.translationKey}`, { lng: ctx.lng }),
			filled: categoryChestItems.length,
			total: maxSlots
		});

		// Inventory capacity info
		const activeItem = categoryDepositableItems.find(item => item.slot === 0);
		const backupCount = categoryDepositableItems.filter(item => item.slot > 0).length;
		const maxBackup = this.getCategorySlotCount(chest.inventoryCapacity, catInfo.category);
		const isInventoryFull = activeItem !== undefined && backupCount >= maxBackup;

		description += `\n${i18n.t("commands:report.city.homes.chest.inventoryInfo", {
			lng: ctx.lng,
			equipped: activeItem
				? "✅"
				: "❌",
			backupCount,
			maxBackup
		})}`;

		// Track all choices and their actions for button mapping
		const choices: {
			type: "deposit" | "withdraw"; category: ItemCategory; slot: number;
		}[] = [];
		const rows: ActionRowBuilder<ButtonBuilder>[] = [new ActionRowBuilder<ButtonBuilder>()];

		const bothFull = !hasEmptySlots && isInventoryFull;

		// Warning banners at the top
		if (!hasEmptySlots) {
			description += `\n\n⚠️ *${i18n.t("commands:report.city.homes.chest.chestFull", { lng: ctx.lng })}*`;
		}
		if (isInventoryFull) {
			description += `\n⚠️ *${i18n.t("commands:report.city.homes.chest.inventoryFullLabel", { lng: ctx.lng })}*`;
		}

		if (bothFull && categoryChestItems.length > 0 && categoryDepositableItems.length > 0) {
			// When both are full, only show the swap section (deposit/withdraw would all be disabled)
			description += `\n\n${i18n.t("commands:report.city.homes.chest.swapSection", { lng: ctx.lng })}`;
			for (const item of categoryDepositableItems) {
				const details = this.withUnlimitedMaxValue(item.details, catInfo.category);
				const itemDisplay = DisplayUtils.getItemDisplayWithStats(details, ctx.lng);
				const emoteIndex = choices.length;

				if (emoteIndex < ChestFeatureHandler.CHOICE_EMOTES.length) {
					description += `\n${ChestFeatureHandler.CHOICE_EMOTES[emoteIndex]} - ${itemDisplay}`;

					const button = new ButtonBuilder()
						.setEmoji(parseEmoji(ChestFeatureHandler.CHOICE_EMOTES[emoteIndex])!)
						.setCustomId(`${HomeMenuIds.CHEST_SWAP_SELECT_PREFIX}${catInfo.category}_${item.slot}`)
						.setStyle(ButtonStyle.Secondary);

					if (rows[rows.length - 1].components.length >= DiscordConstants.MAX_BUTTONS_PER_ROW) {
						rows.push(new ActionRowBuilder<ButtonBuilder>());
					}
					rows[rows.length - 1].addComponents(button);

					choices.push({
						type: "deposit", category: catInfo.category, slot: item.slot
					});
				}
			}
		}
		else {
			// Normal mode: show deposit + withdraw sections
			if (categoryDepositableItems.length > 0) {
				description += `\n\n${i18n.t("commands:report.city.homes.chest.depositSection", { lng: ctx.lng })}`;
				for (const item of categoryDepositableItems) {
					const details = this.withUnlimitedMaxValue(item.details, catInfo.category);
					const itemDisplay = DisplayUtils.getItemDisplayWithStats(details, ctx.lng);
					const emoteIndex = choices.length;

					if (emoteIndex < ChestFeatureHandler.CHOICE_EMOTES.length) {
						description += `\n${ChestFeatureHandler.CHOICE_EMOTES[emoteIndex]} - ${itemDisplay}`;

						const button = new ButtonBuilder()
							.setEmoji(parseEmoji(ChestFeatureHandler.CHOICE_EMOTES[emoteIndex])!)
							.setCustomId(`${HomeMenuIds.CHEST_DEPOSIT_PREFIX}${catInfo.category}_${item.slot}`)
							.setStyle(ButtonStyle.Secondary)
							.setDisabled(!hasEmptySlots);

						if (rows[rows.length - 1].components.length >= DiscordConstants.MAX_BUTTONS_PER_ROW) {
							rows.push(new ActionRowBuilder<ButtonBuilder>());
						}
						rows[rows.length - 1].addComponents(button);

						choices.push({
							type: "deposit", category: catInfo.category, slot: item.slot
						});
					}
				}
			}

			if (categoryChestItems.length > 0) {
				description += `\n\n${i18n.t("commands:report.city.homes.chest.withdrawSection", { lng: ctx.lng })}`;
				for (const item of categoryChestItems) {
					const details = this.withUnlimitedMaxValue(item.details, catInfo.category);
					const itemDisplay = DisplayUtils.getItemDisplayWithStats(details, ctx.lng);
					const emoteIndex = choices.length;

					if (emoteIndex < ChestFeatureHandler.CHOICE_EMOTES.length) {
						description += `\n${ChestFeatureHandler.CHOICE_EMOTES[emoteIndex]} - ${itemDisplay}`;

						const button = new ButtonBuilder()
							.setEmoji(parseEmoji(ChestFeatureHandler.CHOICE_EMOTES[emoteIndex])!)
							.setCustomId(`${HomeMenuIds.CHEST_WITHDRAW_PREFIX}${catInfo.category}_${item.slot}`)
							.setStyle(ButtonStyle.Secondary)
							.setDisabled(isInventoryFull);

						if (rows[rows.length - 1].components.length >= DiscordConstants.MAX_BUTTONS_PER_ROW) {
							rows.push(new ActionRowBuilder<ButtonBuilder>());
						}
						rows[rows.length - 1].addComponents(button);

						choices.push({
							type: "withdraw", category: catInfo.category, slot: item.slot
						});
					}
				}
			}
		}

		if (choices.length === 0) {
			description += `\n\n${i18n.t("commands:report.city.homes.chest.noStoredItems", { lng: ctx.lng })}`;
		}

		// Back button
		const backButton = new ButtonBuilder()
			.setEmoji(parseEmoji(CrowniclesIcons.collectors.refuse)!)
			.setCustomId(HomeMenuIds.CHEST_BACK_TO_CATEGORIES)
			.setStyle(ButtonStyle.Secondary);

		if (rows[rows.length - 1].components.length >= DiscordConstants.MAX_BUTTONS_PER_ROW) {
			rows.push(new ActionRowBuilder<ButtonBuilder>());
		}
		rows[rows.length - 1].addComponents(backButton);

		const { CrowniclesEmbed } = await import("../../../../../messages/CrowniclesEmbed");

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
			createCollector: (menus, message) => {
				const collector = message.createMessageComponentCollector({ time: ctx.collectorTime });
				collector.on("collect", async interaction => {
					if (interaction.user.id !== ctx.user.id) {
						const { sendInteractionNotForYou } = await import("../../../../../utils/ErrorUtils");
						await sendInteractionNotForYou(interaction.user, interaction, ctx.lng);
						return;
					}

					if (interaction.isButton()) {
						const value = interaction.customId;
						await this.handleSubMenuSelection(ctx, value, interaction, menus);
					}
				});
				return collector;
			}
		});
	}

	private async handleDeposit(
		ctx: HomeFeatureHandlerContext,
		selectedValue: string,
		componentInteraction: ComponentInteraction,
		nestedMenus: CrowniclesNestedMenus
	): Promise<void> {
		// Parse "CHEST_DEPOSIT_{category}_{slot}"
		const parts = selectedValue.replace(HomeMenuIds.CHEST_DEPOSIT_PREFIX, "").split("_");
		const category = parseInt(parts[0], 10) as ItemCategory;
		const slot = parseInt(parts[1], 10);

		await componentInteraction.deferUpdate();

		await this.sendChestAction(ctx, "deposit", slot, category, nestedMenus);
	}

	private async handleWithdraw(
		ctx: HomeFeatureHandlerContext,
		selectedValue: string,
		componentInteraction: ComponentInteraction,
		nestedMenus: CrowniclesNestedMenus
	): Promise<void> {
		// Parse "CHEST_WITHDRAW_{category}_{slot}"
		const parts = selectedValue.replace(HomeMenuIds.CHEST_WITHDRAW_PREFIX, "").split("_");
		const category = parseInt(parts[0], 10) as ItemCategory;
		const slot = parseInt(parts[1], 10);

		await componentInteraction.deferUpdate();

		await this.sendChestAction(ctx, "withdraw", slot, category, nestedMenus);
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
		// Parse "CHEST_SWAP_SEL_{category}_{inventorySlot}"
		const parts = selectedValue.replace(HomeMenuIds.CHEST_SWAP_SELECT_PREFIX, "").split("_");
		const category = parseInt(parts[0], 10) as ItemCategory;
		const inventorySlot = parseInt(parts[1], 10);

		await componentInteraction.deferUpdate();

		const categoryIndex = CATEGORY_INFO.findIndex(c => c.category === category);
		if (categoryIndex === -1) {
			return;
		}

		await this.registerSwapTargetMenu(ctx, categoryIndex, inventorySlot, nestedMenus);
		await nestedMenus.changeMenu(`${HomeMenuIds.CHEST_SWAP_MENU_PREFIX}${categoryIndex}_${inventorySlot}`);
	}

	/**
	 * Handle step 2 of swap: player selected a chest item to swap with.
	 * Execute the swap action via Core.
	 */
	private async handleSwapTarget(
		ctx: HomeFeatureHandlerContext,
		selectedValue: string,
		componentInteraction: ComponentInteraction,
		nestedMenus: CrowniclesNestedMenus
	): Promise<void> {
		// Parse "CHEST_SWAP_TGT_{category}_{inventorySlot}_{chestSlot}"
		const parts = selectedValue.replace(HomeMenuIds.CHEST_SWAP_TARGET_PREFIX, "").split("_");
		const category = parseInt(parts[0], 10) as ItemCategory;
		const inventorySlot = parseInt(parts[1], 10);
		const chestSlot = parseInt(parts[2], 10);

		await componentInteraction.deferUpdate();

		await this.sendChestAction(ctx, "swap", inventorySlot, category, nestedMenus, chestSlot);
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

		// Find the selected inventory item for display
		const selectedItem = categoryDepositableItems.find(item => item.slot === inventorySlot);
		const menuId = `${HomeMenuIds.CHEST_SWAP_MENU_PREFIX}${categoryIndex}_${inventorySlot}`;

		let description = i18n.t("commands:report.city.homes.chest.swapHeader", {
			lng: ctx.lng,
			item: selectedItem
				? DisplayUtils.getItemDisplayWithStats(
					this.withUnlimitedMaxValue(selectedItem.details, catInfo.category), ctx.lng
				)
				: "?"
		});

		description += "\n";

		const rows: ActionRowBuilder<ButtonBuilder>[] = [new ActionRowBuilder<ButtonBuilder>()];

		for (let j = 0; j < categoryChestItems.length; j++) {
			const chestItem = categoryChestItems[j];
			const details = this.withUnlimitedMaxValue(chestItem.details, catInfo.category);
			const itemDisplay = DisplayUtils.getItemDisplayWithStats(details, ctx.lng);

			if (j < ChestFeatureHandler.CHOICE_EMOTES.length) {
				description += `\n${ChestFeatureHandler.CHOICE_EMOTES[j]} - ${itemDisplay}`;

				const button = new ButtonBuilder()
					.setEmoji(parseEmoji(ChestFeatureHandler.CHOICE_EMOTES[j])!)
					.setCustomId(`${HomeMenuIds.CHEST_SWAP_TARGET_PREFIX}${catInfo.category}_${inventorySlot}_${chestItem.slot}`)
					.setStyle(ButtonStyle.Secondary);

				if (rows[rows.length - 1].components.length >= DiscordConstants.MAX_BUTTONS_PER_ROW) {
					rows.push(new ActionRowBuilder<ButtonBuilder>());
				}
				rows[rows.length - 1].addComponents(button);
			}
		}

		// Back button
		const backButton = new ButtonBuilder()
			.setEmoji(parseEmoji(CrowniclesIcons.collectors.refuse)!)
			.setCustomId(`${HomeMenuIds.CHEST_BACK_TO_DETAIL_PREFIX}${categoryIndex}`)
			.setStyle(ButtonStyle.Secondary);

		if (rows[rows.length - 1].components.length >= DiscordConstants.MAX_BUTTONS_PER_ROW) {
			rows.push(new ActionRowBuilder<ButtonBuilder>());
		}
		rows[rows.length - 1].addComponents(backButton);

		const { CrowniclesEmbed } = await import("../../../../../messages/CrowniclesEmbed");

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
			createCollector: (menus, message) => {
				const collector = message.createMessageComponentCollector({ time: ctx.collectorTime });
				collector.on("collect", async interaction => {
					if (interaction.user.id !== ctx.user.id) {
						const { sendInteractionNotForYou } = await import("../../../../../utils/ErrorUtils");
						await sendInteractionNotForYou(interaction.user, interaction, ctx.lng);
						return;
					}

					if (interaction.isButton()) {
						await this.handleSubMenuSelection(ctx, interaction.customId, interaction, menus);
					}
				});
				return collector;
			}
		});
	}

	/**
	 * Send a chest action (deposit/withdraw/swap) directly to Core via AsyncPacketSender
	 * and update the menu in-place with the refreshed data.
	 */
	private async sendChestAction(
		ctx: HomeFeatureHandlerContext,
		action: string,
		slot: number,
		itemCategory: ItemCategory,
		nestedMenus: CrowniclesNestedMenus,
		chestSlot?: number
	): Promise<void> {
		await DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse(
			ctx.context,
			makePacket(CommandReportHomeChestActionReq, {
				action, slot, itemCategory, chestSlot: chestSlot ?? -1
			}),
			async (_responseContext, _packetName, responsePacket) => {
				const response = responsePacket as unknown as CommandReportHomeChestActionRes;

				if (!response.success) {
					/*
					 * Stay on the same menu — the view will naturally show the error state
					 * (e.g., full chest = disabled deposit buttons, full inventory = can't withdraw)
					 */
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

				// Find the category index from the itemCategory
				const categoryIndex = CATEGORY_INFO.findIndex(c => c.category === itemCategory);
				if (categoryIndex !== -1) {
					// Rebuild and refresh the category detail view in-place
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
			const maxSlots = this.getCategorySlotCount(chest.slotsPerCategory, catInfo.category);
			if (maxSlots === 0) {
				continue;
			}
			const filledCount = chest.chestItems.filter(item => item.category === catInfo.category).length;
			buttons.push(
				new ButtonBuilder()
					.setCustomId(`${HomeMenuIds.CHEST_CATEGORY_PREFIX}${i}`)
					.setLabel(`${i18n.t(`commands:report.city.homes.chest.categories.${catInfo.translationKey}`, { lng: ctx.lng })} (${filledCount}/${maxSlots})`)
					.setEmoji(catInfo.emoji)
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
