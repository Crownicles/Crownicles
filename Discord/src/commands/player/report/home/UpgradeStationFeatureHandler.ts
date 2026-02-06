import {
	ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuInteraction
} from "discord.js";
import {
	ComponentInteraction,
	HomeFeatureHandler, HomeFeatureHandlerContext, HomeFeatureMenuOption
} from "./HomeMenuTypes";
import { CrowniclesNestedMenus } from "../../../../messages/CrowniclesNestedMenus";
import i18n from "../../../../translations/i18n";
import { DisplayUtils } from "../../../../utils/DisplayUtils";
import { CrowniclesIcons } from "../../../../../../Lib/src/CrowniclesIcons";
import { ReactionCollectorUpgradeItemReaction } from "../../../../../../Lib/src/packets/interaction/ReactionCollectorCity";
import { DiscordCollectorUtils } from "../../../../utils/DiscordCollectorUtils";
import { ItemRarity } from "../../../../../../Lib/src/constants/ItemConstants";
import { CrowniclesEmbed } from "../../../../messages/CrowniclesEmbed";
import { sendInteractionNotForYou } from "../../../../utils/ErrorUtils";
import { Language } from "../../../../../../Lib/src/Language";
import {
	ADVANCED_UPGRADE_LEVEL_THRESHOLD, HomeMenuIds
} from "./HomeMenuConstants";

/**
 * Handler for the upgrade station feature in the home.
 * Allows players to upgrade their equipment using materials.
 */
export class UpgradeStationFeatureHandler implements HomeFeatureHandler {
	public readonly featureId = "upgradeStation";

	/**
	 * Check if the given item index is valid for the upgrade station
	 */
	private isValidItemIndex(ctx: HomeFeatureHandlerContext, itemIndex: number): boolean {
		const upgradeStation = ctx.homeData.upgradeStation;
		return Boolean(upgradeStation)
			&& itemIndex >= 0
			&& itemIndex < (upgradeStation?.upgradeableItems.length ?? 0);
	}

	public isAvailable(ctx: HomeFeatureHandlerContext): boolean {
		// Available if the home has an upgrade station (upgradeItemMaximumRarity > BASIC means it has one)
		return ctx.homeData.features.upgradeItemMaximumRarity > ItemRarity.BASIC;
	}

	public getMenuOption(ctx: HomeFeatureHandlerContext): HomeFeatureMenuOption | null {
		if (!this.isAvailable(ctx)) {
			return null;
		}

		const upgradeStation = ctx.homeData.upgradeStation;
		const itemCount = upgradeStation?.upgradeableItems.length ?? 0;

		return {
			label: i18n.t("commands:report.city.homes.upgradeStation.menuLabel", { lng: ctx.lng }),
			description: i18n.t("commands:report.city.homes.upgradeStation.menuDescription", {
				lng: ctx.lng,
				count: itemCount
			}),
			emoji: CrowniclesIcons.city.homeUpgrades.upgradeEquipment,
			value: HomeMenuIds.UPGRADE_STATION
		};
	}

	public getDescriptionLines(_ctx: HomeFeatureHandlerContext): string[] {
		if (!this.isAvailable(_ctx)) {
			return [];
		}

		return [i18n.t("commands:report.city.homes.upgradeStation.available", { lng: _ctx.lng })];
	}

	public async handleFeatureSelection(
		_ctx: HomeFeatureHandlerContext,
		selectInteraction: StringSelectMenuInteraction,
		nestedMenus: CrowniclesNestedMenus
	): Promise<void> {
		await selectInteraction.deferUpdate();
		await nestedMenus.changeMenu(HomeMenuIds.UPGRADE_STATION);
	}

	/**
	 * Parse an index from a prefixed selection value
	 * @returns The parsed index or null if invalid
	 */
	private parseIndexFromValue(selectedValue: string, prefix: string): number | null {
		const index = parseInt(selectedValue.replace(prefix, ""), 10);
		return Number.isNaN(index) ? null : index;
	}

	/**
	 * Handle navigation back to a specific menu
	 */
	private async handleNavigateBack(
		componentInteraction: ComponentInteraction,
		nestedMenus: CrowniclesNestedMenus,
		targetMenu: string
	): Promise<boolean> {
		await componentInteraction.deferUpdate();
		await nestedMenus.changeMenu(targetMenu);
		return true;
	}

	/**
	 * Generic handler for index-based actions (item selection, upgrade confirmation)
	 * Extracts index from value, validates it, and calls the action handler
	 */
	private async handleIndexedAction(
		selectedValue: string,
		prefix: string,
		componentInteraction: ComponentInteraction,
		actionHandler: (index: number) => Promise<void>
	): Promise<boolean> {
		const index = this.parseIndexFromValue(selectedValue, prefix);
		if (index === null) {
			await componentInteraction.deferUpdate();
			return false;
		}
		await actionHandler(index);
		return true;
	}

	public async handleSubMenuSelection(
		ctx: HomeFeatureHandlerContext,
		selectedValue: string,
		componentInteraction: ComponentInteraction,
		nestedMenus: CrowniclesNestedMenus
	): Promise<boolean> {
		if (selectedValue === HomeMenuIds.BACK_TO_HOME) {
			return await this.handleNavigateBack(componentInteraction, nestedMenus, HomeMenuIds.HOME_MENU);
		}

		if (selectedValue === HomeMenuIds.UPGRADE_BACK_TO_ITEMS) {
			return await this.handleNavigateBack(componentInteraction, nestedMenus, HomeMenuIds.UPGRADE_STATION);
		}

		if (selectedValue.startsWith(HomeMenuIds.UPGRADE_ITEM_PREFIX)) {
			return await this.handleIndexedAction(
				selectedValue,
				HomeMenuIds.UPGRADE_ITEM_PREFIX,
				componentInteraction,
				index => this.showItemDetails(ctx, index, componentInteraction, nestedMenus)
			);
		}

		if (selectedValue.startsWith(HomeMenuIds.UPGRADE_CONFIRM_PREFIX)) {
			return await this.handleIndexedAction(
				selectedValue,
				HomeMenuIds.UPGRADE_CONFIRM_PREFIX,
				componentInteraction,
				index => this.confirmUpgrade(ctx, index, componentInteraction)
			);
		}

		return false;
	}

	/**
	 * Build the description for an item's upgrade details
	 */
	private buildItemDescription(
		ctx: HomeFeatureHandlerContext,
		item: NonNullable<typeof ctx.homeData.upgradeStation>["upgradeableItems"][0]
	): string {
		const materialLines = item.requiredMaterials.map(mat => {
			const icon = CrowniclesIcons.materials[mat.materialId] ?? CrowniclesIcons.collectors.question;
			const materialName = i18n.t(`models:materials.${mat.materialId}`, { lng: ctx.lng });
			const hasEnough = mat.playerQuantity >= mat.quantity;
			const statusIcon = hasEnough ? CrowniclesIcons.collectors.accept : CrowniclesIcons.collectors.refuse;
			return `${statusIcon} ${icon} **${materialName}** : ${mat.playerQuantity}/${mat.quantity}`;
		});

		item.details.attack.maxValue = Infinity;
		item.details.defense.maxValue = Infinity;
		item.details.speed.maxValue = Infinity;
		const itemDisplay = DisplayUtils.getItemDisplayWithStats(item.details, ctx.lng);

		return i18n.t("commands:report.city.homes.upgradeStation.itemDetails", {
			lng: ctx.lng,
			itemDisplay,
			currentLevel: item.details.itemLevel ?? 0,
			nextLevel: item.nextLevel,
			materials: materialLines.join("\n")
		});
	}

	/**
	 * Build the action buttons for the item detail view
	 */
	private buildItemDetailButtons(ctx: HomeFeatureHandlerContext, itemIndex: number, canUpgrade: boolean): ActionRowBuilder<ButtonBuilder> {
		const confirmButton = new ButtonBuilder()
			.setCustomId(`${HomeMenuIds.UPGRADE_CONFIRM_PREFIX}${itemIndex}`)
			.setLabel(i18n.t("commands:report.city.homes.upgradeStation.confirmUpgrade", { lng: ctx.lng }))
			.setStyle(canUpgrade ? ButtonStyle.Success : ButtonStyle.Secondary)
			.setDisabled(!canUpgrade);

		const backButton = new ButtonBuilder()
			.setCustomId(HomeMenuIds.UPGRADE_BACK_TO_ITEMS)
			.setLabel(i18n.t("commands:report.city.homes.upgradeStation.backToItems", { lng: ctx.lng }))
			.setStyle(ButtonStyle.Secondary)
			.setEmoji(CrowniclesIcons.collectors.back);

		return new ActionRowBuilder<ButtonBuilder>().addComponents(backButton, confirmButton);
	}

	/**
	 * Show detailed view for a selected item with material requirements
	 */
	private async showItemDetails(
		ctx: HomeFeatureHandlerContext,
		itemIndex: number,
		componentInteraction: ComponentInteraction,
		nestedMenus: CrowniclesNestedMenus
	): Promise<void> {
		if (!this.isValidItemIndex(ctx, itemIndex)) {
			await componentInteraction.deferUpdate();
			return;
		}

		const item = ctx.homeData.upgradeStation!.upgradeableItems[itemIndex];
		const menuId = `${HomeMenuIds.UPGRADE_ITEM_DETAIL_PREFIX}${itemIndex}`;
		const description = this.buildItemDescription(ctx, item);

		nestedMenus.registerMenu(menuId, {
			embed: new CrowniclesEmbed()
				.formatAuthor(
					i18n.t("commands:report.city.homes.upgradeStation.title", {
						lng: ctx.lng, pseudo: ctx.pseudo
					}),
					ctx.user
				)
				.setDescription(description),
			components: [this.buildItemDetailButtons(ctx, itemIndex, item.canUpgrade)],
			createCollector: (menus, message) => {
				const buttonCollector = message.createMessageComponentCollector({ time: ctx.collectorTime });

				buttonCollector.on("collect", async (buttonInteraction: ButtonInteraction) => {
					if (buttonInteraction.user.id !== ctx.user.id) {
						await sendInteractionNotForYou(buttonInteraction.user, buttonInteraction, ctx.lng);
						return;
					}

					if (buttonInteraction.customId === HomeMenuIds.UPGRADE_BACK_TO_ITEMS) {
						await buttonInteraction.deferUpdate();
						await menus.changeMenu(HomeMenuIds.UPGRADE_STATION);
						return;
					}

					if (buttonInteraction.customId.startsWith(HomeMenuIds.UPGRADE_CONFIRM_PREFIX)) {
						await this.confirmUpgrade(ctx, itemIndex, buttonInteraction);
					}
				});

				return buttonCollector;
			}
		});

		await componentInteraction.deferUpdate();
		await nestedMenus.changeMenu(menuId);
	}

	/**
	 * Confirm and execute the upgrade
	 */
	private async confirmUpgrade(
		ctx: HomeFeatureHandlerContext,
		itemIndex: number,
		componentInteraction: ComponentInteraction
	): Promise<void> {
		if (!this.isValidItemIndex(ctx, itemIndex)) {
			return;
		}

		const upgradeStation = ctx.homeData.upgradeStation!;
		const item = upgradeStation.upgradeableItems[itemIndex];

		await componentInteraction.deferReply();

		const reactionIndex = ctx.packet.reactions.findIndex(
			reaction => reaction.type === ReactionCollectorUpgradeItemReaction.name
				&& (reaction.data as ReactionCollectorUpgradeItemReaction).slot === item.slot
				&& (reaction.data as ReactionCollectorUpgradeItemReaction).itemCategory === item.category
		);

		if (reactionIndex !== -1) {
			DiscordCollectorUtils.sendReaction(ctx.packet, ctx.context, ctx.context.keycloakId!, componentInteraction, reactionIndex);
		}
	}

	public addSubMenuOptions(ctx: HomeFeatureHandlerContext, selectMenu: StringSelectMenuBuilder): void {
		const upgradeStation = ctx.homeData.upgradeStation;

		if (!upgradeStation) {
			return;
		}

		for (let i = 0; i < upgradeStation.upgradeableItems.length; i++) {
			const item = upgradeStation.upgradeableItems[i];

			// Set maxValue to Infinity to not display max values in stats
			item.details.attack.maxValue = Infinity;
			item.details.defense.maxValue = Infinity;
			item.details.speed.maxValue = Infinity;

			const itemDisplay = DisplayUtils.getItemDisplayWithStats(item.details, ctx.lng);
			const parts = itemDisplay.split(" | ");
			const label = parts[0].split("**")[1];

			// Simple description: level transition only
			const rawDescription = `+${item.details.itemLevel ?? 0} → +${item.nextLevel}`;

			const option: {
				label: string;
				value: string;
				emoji: string;
				description?: string;
			} = {
				label,
				value: `${HomeMenuIds.UPGRADE_ITEM_PREFIX}${i}`,
				emoji: DisplayUtils.getItemIcon({
					id: item.details.id,
					category: item.details.itemCategory
				}),
				description: rawDescription
			};

			selectMenu.addOptions(option);
		}
	}

	public getSubMenuDescription(ctx: HomeFeatureHandlerContext): string {
		const upgradeStation = ctx.homeData.upgradeStation;
		const hasItems = upgradeStation && upgradeStation.upgradeableItems.length > 0;

		const maxLevelAtHome = ctx.homeData.features.maxItemUpgradeLevel;
		const maxRarity = upgradeStation?.maxUpgradeableRarity ?? ItemRarity.BASIC;

		// Determine station quality description based on home level
		const stationQuality = this.getStationQualityText(ctx.lng, maxRarity);

		// Determine level limitation text
		const levelLimitation = this.getLevelLimitationText(ctx.lng, maxLevelAtHome);

		const translationKey = hasItems
			? "commands:report.city.homes.upgradeStation.descriptionWithItems"
			: "commands:report.city.homes.upgradeStation.descriptionNoItems";

		return i18n.t(translationKey, {
			lng: ctx.lng,
			stationQuality,
			maxRarity,
			levelLimitation
		});
	}

	/**
	 * Get the localized station quality text based on max rarity
	 */
	private getStationQualityText(lng: Language, maxRarity: ItemRarity): string {
		if (maxRarity >= ItemRarity.LEGENDARY) {
			return i18n.t("commands:report.city.homes.upgradeStation.stationQualityMaster", { lng });
		}
		if (maxRarity >= ItemRarity.EPIC) {
			return i18n.t("commands:report.city.homes.upgradeStation.stationQualityAdvanced", { lng });
		}
		return i18n.t("commands:report.city.homes.upgradeStation.stationQualityBasic", { lng });
	}

	/**
	 * Get the level limitation text based on max upgrade level at home
	 */
	private getLevelLimitationText(lng: Language, maxLevel: number): string {
		const key = maxLevel >= ADVANCED_UPGRADE_LEVEL_THRESHOLD
			? "commands:report.city.homes.upgradeStation.levelLimitationAdvanced"
			: "commands:report.city.homes.upgradeStation.levelLimitationBasic";

		return i18n.t(key, {
			lng,
			maxLevel
		});
	}

	public getSubMenuPlaceholder(ctx: HomeFeatureHandlerContext): string {
		return i18n.t("commands:report.city.homes.upgradeStation.placeholder", { lng: ctx.lng });
	}

	public getSubMenuTitle(ctx: HomeFeatureHandlerContext, pseudo: string): string {
		return i18n.t("commands:report.city.homes.upgradeStation.title", {
			lng: ctx.lng,
			pseudo
		});
	}
}
