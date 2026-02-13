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
import {
	ReactionCollectorHomeChestDepositReaction,
	ReactionCollectorHomeChestWithdrawReaction
} from "../../../../../../../Lib/src/packets/interaction/ReactionCollectorCity";
import { DiscordCollectorUtils } from "../../../../../utils/DiscordCollectorUtils";
import { ItemCategory } from "../../../../../../../Lib/src/constants/ItemConstants";
import { HomeMenuIds } from "../HomeMenuConstants";
import { ChestSlotsPerCategory } from "../../../../../../../Lib/src/types/HomeFeatures";
import { MainItemDetails } from "../../../../../../../Lib/src/types/MainItemDetails";
import { ItemWithDetails } from "../../../../../../../Lib/src/types/ItemWithDetails";
import { MessageActionRowComponentBuilder } from "@discordjs/builders";
import { DiscordConstants } from "../../../../../DiscordConstants";

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

		const chest = ctx.homeData.chest;
		if (!chest) {
			await componentInteraction.deferUpdate();
			return;
		}

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

		// Track all choices and their actions for button mapping
		const choices: {
			type: "deposit" | "withdraw"; category: ItemCategory; slot: number;
		}[] = [];
		const rows: ActionRowBuilder<ButtonBuilder>[] = [new ActionRowBuilder<ButtonBuilder>()];

		// Deposit section — items from inventory that can be stored
		if (categoryDepositableItems.length > 0) {
			description += `\n\n${i18n.t("commands:report.city.homes.chest.depositSection", { lng: ctx.lng })}`;
			for (const item of categoryDepositableItems) {
				const details = this.withUnlimitedMaxValue(item.details, catInfo.category);
				const itemDisplay = DisplayUtils.getItemDisplayWithStats(details, ctx.lng);
				const emoteIndex = choices.length;

				if (emoteIndex < ChestFeatureHandler.CHOICE_EMOTES.length) {
					description += `\n${ChestFeatureHandler.CHOICE_EMOTES[emoteIndex]} - ${itemDisplay}`;
					if (!hasEmptySlots) {
						description += ` *(${i18n.t("commands:report.city.homes.chest.chestFull", { lng: ctx.lng })})*`;
					}

					const button = new ButtonBuilder()
						.setEmoji(parseEmoji(ChestFeatureHandler.CHOICE_EMOTES[emoteIndex])!)
						.setCustomId(`${HomeMenuIds.CHEST_DEPOSIT_PREFIX}${catInfo.category}_${item.slot}`)
						.setStyle(hasEmptySlots ? ButtonStyle.Secondary : ButtonStyle.Secondary)
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

		// Withdraw section — items in the chest that can be retrieved
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
						.setStyle(ButtonStyle.Secondary);

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
