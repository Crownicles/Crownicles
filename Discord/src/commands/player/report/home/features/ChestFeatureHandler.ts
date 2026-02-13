import {
	StringSelectMenuBuilder, StringSelectMenuInteraction
} from "discord.js";
import {
	ComponentInteraction,
	HomeFeatureHandler, HomeFeatureHandlerContext, HomeFeatureMenuOption
} from "../HomeMenuTypes";
import { CrowniclesNestedMenus } from "../../../../../messages/CrowniclesNestedMenus";
import i18n from "../../../../../translations/i18n";
import { DisplayUtils } from "../../../../../utils/DisplayUtils";
import { CrowniclesIcons } from "../../../../../../../Lib/src/CrowniclesIcons";
import {
	ReactionCollectorHomeChestDepositReaction,
	ReactionCollectorHomeChestWithdrawReaction
} from "../../../../../../../Lib/src/packets/interaction/ReactionCollectorCity";
import { DiscordCollectorUtils } from "../../../../../utils/DiscordCollectorUtils";
import { ItemCategory } from "../../../../../../../Lib/src/constants/ItemConstants";
import { HomeMenuIds } from "../HomeMenuConstants";
import { ChestSlotsPerCategory } from "../../../../../../../Lib/src/types/HomeFeatures";

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
			await this.handleDeposit(ctx, selectedValue, componentInteraction);
			return true;
		}

		if (selectedValue.startsWith(HomeMenuIds.CHEST_WITHDRAW_PREFIX)) {
			await this.handleWithdraw(ctx, selectedValue, componentInteraction);
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

		const chest = ctx.homeData.chest;
		if (!chest) {
			await componentInteraction.deferUpdate();
			return;
		}

		const categoryChestItems = chest.chestItems.filter(item => item.category === catInfo.category);
		const categoryDepositableItems = chest.depositableItems.filter(item => item.category === catInfo.category);
		const maxSlots = this.getCategorySlotCount(chest.slotsPerCategory, catInfo.category);

		const menuId = `${HomeMenuIds.CHEST_CATEGORY_DETAIL_PREFIX}${categoryIndex}`;

		// Build description
		let description = i18n.t("commands:report.city.homes.chest.categoryHeader", {
			lng: ctx.lng,
			category: i18n.t(`commands:report.city.homes.chest.categories.${catInfo.translationKey}`, { lng: ctx.lng }),
			filled: categoryChestItems.length,
			total: maxSlots
		});

		if (categoryChestItems.length > 0) {
			description += `\n\n${i18n.t("commands:report.city.homes.chest.storedItems", { lng: ctx.lng })}`;
			for (const item of categoryChestItems) {
				item.details.attack.maxValue = Infinity;
				item.details.defense.maxValue = Infinity;
				item.details.speed.maxValue = Infinity;
				description += `\n• ${DisplayUtils.getItemDisplayWithStats(item.details, ctx.lng)}`;
			}
		}
		else {
			description += `\n\n${i18n.t("commands:report.city.homes.chest.noStoredItems", { lng: ctx.lng })}`;
		}

		// Build select menu options
		const selectMenu = new StringSelectMenuBuilder()
			.setCustomId(`chest_category_${categoryIndex}_select`)
			.setPlaceholder(i18n.t("commands:report.city.homes.chest.actionPlaceholder", { lng: ctx.lng }));

		// "Back" option
		selectMenu.addOptions({
			label: i18n.t("commands:report.city.homes.chest.backToCategories", { lng: ctx.lng }),
			value: HomeMenuIds.CHEST_BACK_TO_CATEGORIES,
			emoji: CrowniclesIcons.city.back
		});

		// Deposit options
		const hasEmptySlots = categoryChestItems.length < maxSlots;
		for (let i = 0; i < categoryDepositableItems.length; i++) {
			const item = categoryDepositableItems[i];
			item.details.attack.maxValue = Infinity;
			item.details.defense.maxValue = Infinity;
			item.details.speed.maxValue = Infinity;
			const itemDisplay = DisplayUtils.getItemDisplayWithStats(item.details, ctx.lng);
			const parts = itemDisplay.split(" | ");
			const label = i18n.t("commands:report.city.homes.chest.depositLabel", { lng: ctx.lng });
			selectMenu.addOptions({
				label: `${label} ${parts[0].replace(/\*\*/g, "").substring(0, 80)}`,
				value: `${HomeMenuIds.CHEST_DEPOSIT_PREFIX}${catInfo.category}_${item.slot}`,
				emoji: DisplayUtils.getItemIcon({
					id: item.details.id, category: item.details.itemCategory
				}),
				description: hasEmptySlots ? undefined : i18n.t("commands:report.city.homes.chest.chestFull", { lng: ctx.lng })
			});
		}

		// Withdraw options
		for (let i = 0; i < categoryChestItems.length; i++) {
			const item = categoryChestItems[i];
			item.details.attack.maxValue = Infinity;
			item.details.defense.maxValue = Infinity;
			item.details.speed.maxValue = Infinity;
			const itemDisplay = DisplayUtils.getItemDisplayWithStats(item.details, ctx.lng);
			const parts = itemDisplay.split(" | ");
			const label = i18n.t("commands:report.city.homes.chest.withdrawLabel", { lng: ctx.lng });
			selectMenu.addOptions({
				label: `${label} ${parts[0].replace(/\*\*/g, "").substring(0, 80)}`,
				value: `${HomeMenuIds.CHEST_WITHDRAW_PREFIX}${catInfo.category}_${item.slot}`,
				emoji: DisplayUtils.getItemIcon({
					id: item.details.id, category: item.details.itemCategory
				})
			});
		}

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
			components: [new (await import("discord.js")).ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu)],
			createCollector: (menus, message) => {
				const collector = message.createMessageComponentCollector({ time: ctx.collectorTime });
				collector.on("collect", async interaction => {
					if (interaction.user.id !== ctx.user.id) {
						const { sendInteractionNotForYou } = await import("../../../../../utils/ErrorUtils");
						await sendInteractionNotForYou(interaction.user, interaction, ctx.lng);
						return;
					}

					if (interaction.isStringSelectMenu()) {
						const value = interaction.values[0];
						await this.handleSubMenuSelection(ctx, value, interaction, menus);
					}
				});
				return collector;
			}
		});

		await componentInteraction.deferUpdate();
		await nestedMenus.changeMenu(menuId);
	}

	private async handleDeposit(
		ctx: HomeFeatureHandlerContext,
		selectedValue: string,
		componentInteraction: ComponentInteraction
	): Promise<void> {
		// Parse "CHEST_DEPOSIT_{category}_{slot}"
		const parts = selectedValue.replace(HomeMenuIds.CHEST_DEPOSIT_PREFIX, "").split("_");
		const category = parseInt(parts[0], 10) as ItemCategory;
		const slot = parseInt(parts[1], 10);

		await componentInteraction.deferReply();

		const reactionIndex = ctx.packet.reactions.findIndex(
			reaction => reaction.type === ReactionCollectorHomeChestDepositReaction.name
				&& (reaction.data as ReactionCollectorHomeChestDepositReaction).inventorySlot === slot
				&& (reaction.data as ReactionCollectorHomeChestDepositReaction).itemCategory === category
		);

		if (reactionIndex !== -1) {
			DiscordCollectorUtils.sendReaction(ctx.packet, ctx.context, ctx.context.keycloakId!, componentInteraction, reactionIndex);
		}
	}

	private async handleWithdraw(
		ctx: HomeFeatureHandlerContext,
		selectedValue: string,
		componentInteraction: ComponentInteraction
	): Promise<void> {
		// Parse "CHEST_WITHDRAW_{category}_{slot}"
		const parts = selectedValue.replace(HomeMenuIds.CHEST_WITHDRAW_PREFIX, "").split("_");
		const category = parseInt(parts[0], 10) as ItemCategory;
		const slot = parseInt(parts[1], 10);

		await componentInteraction.deferReply();

		const reactionIndex = ctx.packet.reactions.findIndex(
			reaction => reaction.type === ReactionCollectorHomeChestWithdrawReaction.name
				&& (reaction.data as ReactionCollectorHomeChestWithdrawReaction).chestSlot === slot
				&& (reaction.data as ReactionCollectorHomeChestWithdrawReaction).itemCategory === category
		);

		if (reactionIndex !== -1) {
			DiscordCollectorUtils.sendReaction(ctx.packet, ctx.context, ctx.context.keycloakId!, componentInteraction, reactionIndex);
		}
	}

	public addSubMenuOptions(ctx: HomeFeatureHandlerContext, selectMenu: StringSelectMenuBuilder): void {
		const chest = ctx.homeData.chest;
		if (!chest) {
			return;
		}

		for (let i = 0; i < CATEGORY_INFO.length; i++) {
			const catInfo = CATEGORY_INFO[i];
			const maxSlots = this.getCategorySlotCount(chest.slotsPerCategory, catInfo.category);
			if (maxSlots === 0) {
				continue;
			}
			const filledCount = chest.chestItems.filter(item => item.category === catInfo.category).length;
			selectMenu.addOptions({
				label: i18n.t(`commands:report.city.homes.chest.categories.${catInfo.translationKey}`, { lng: ctx.lng }),
				value: `${HomeMenuIds.CHEST_CATEGORY_PREFIX}${i}`,
				emoji: catInfo.emoji,
				description: i18n.t("commands:report.city.homes.chest.categorySlots", {
					lng: ctx.lng, filled: filledCount, total: maxSlots
				})
			});
		}
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
