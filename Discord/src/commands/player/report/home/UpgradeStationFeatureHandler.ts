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
import {
	ItemConstants, ItemRarity
} from "../../../../../../Lib/src/constants/ItemConstants";
import { CrowniclesEmbed } from "../../../../messages/CrowniclesEmbed";
import { sendInteractionNotForYou } from "../../../../utils/ErrorUtils";

/**
 * Handler for the upgrade station feature in the home.
 * Allows players to upgrade their equipment using materials.
 */
export class UpgradeStationFeatureHandler implements HomeFeatureHandler {
	public readonly featureId = "upgradeStation";

	private static readonly MENU_VALUE = "HOME_UPGRADE_STATION";

	private static readonly ITEM_PREFIX = "UPGRADE_ITEM_";

	private static readonly CONFIRM_PREFIX = "CONFIRM_UPGRADE_";

	private static readonly BACK_TO_ITEMS = "BACK_TO_ITEMS";

	private static readonly ITEM_DETAIL_MENU_PREFIX = "UPGRADE_ITEM_DETAIL_";

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
			value: UpgradeStationFeatureHandler.MENU_VALUE
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
		await nestedMenus.changeMenu("HOME_UPGRADE_STATION");
	}

	public async handleSubMenuSelection(
		ctx: HomeFeatureHandlerContext,
		selectedValue: string,
		componentInteraction: ComponentInteraction,
		nestedMenus: CrowniclesNestedMenus
	): Promise<boolean> {
		// Handle back to home menu
		if (selectedValue === "BACK_TO_HOME") {
			await componentInteraction.deferUpdate();
			await nestedMenus.changeMenu("HOME_MENU");
			return true;
		}

		// Handle back to items list from detail view
		if (selectedValue === UpgradeStationFeatureHandler.BACK_TO_ITEMS) {
			await componentInteraction.deferUpdate();
			await nestedMenus.changeMenu("HOME_UPGRADE_STATION");
			return true;
		}

		// Handle item selection to show details
		if (selectedValue.startsWith(UpgradeStationFeatureHandler.ITEM_PREFIX)) {
			const index = parseInt(selectedValue.replace(UpgradeStationFeatureHandler.ITEM_PREFIX, ""), 10);
			await this.showItemDetails(ctx, index, componentInteraction, nestedMenus);
			return true;
		}

		// Handle upgrade confirmation
		if (selectedValue.startsWith(UpgradeStationFeatureHandler.CONFIRM_PREFIX)) {
			const index = parseInt(selectedValue.replace(UpgradeStationFeatureHandler.CONFIRM_PREFIX, ""), 10);
			await this.confirmUpgrade(ctx, index, componentInteraction);
			return true;
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
			.setCustomId(`${UpgradeStationFeatureHandler.CONFIRM_PREFIX}${itemIndex}`)
			.setLabel(i18n.t("commands:report.city.homes.upgradeStation.confirmUpgrade", { lng: ctx.lng }))
			.setStyle(canUpgrade ? ButtonStyle.Success : ButtonStyle.Secondary)
			.setDisabled(!canUpgrade);

		const backButton = new ButtonBuilder()
			.setCustomId(UpgradeStationFeatureHandler.BACK_TO_ITEMS)
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
		const menuId = `${UpgradeStationFeatureHandler.ITEM_DETAIL_MENU_PREFIX}${itemIndex}`;
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

					if (buttonInteraction.customId === UpgradeStationFeatureHandler.BACK_TO_ITEMS) {
						await buttonInteraction.deferUpdate();
						await menus.changeMenu("HOME_UPGRADE_STATION");
						return;
					}

					if (buttonInteraction.customId.startsWith(UpgradeStationFeatureHandler.CONFIRM_PREFIX)) {
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
				value: `${UpgradeStationFeatureHandler.ITEM_PREFIX}${i}`,
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
		const lines: string[] = [];

		if (!upgradeStation || upgradeStation.upgradeableItems.length === 0) {
			lines.push(i18n.t("commands:report.city.homes.upgradeStation.noItems", { lng: ctx.lng }));
		}
		else {
			lines.push(i18n.t("commands:report.city.homes.upgradeStation.selectItem", { lng: ctx.lng }));
		}

		// Add explanatory text about which items are not shown
		lines.push("");

		// Explain level limitation
		const maxLevelAtHome = ItemConstants.MAX_UPGRADE_LEVEL_AT_HOME;
		lines.push(i18n.t("commands:report.city.homes.upgradeStation.levelLimitation", {
			lng: ctx.lng,
			maxLevel: maxLevelAtHome
		}));

		// Explain rarity limitation based on home level (only if not max rarity)
		if (upgradeStation && upgradeStation.maxUpgradeableRarity < ItemRarity.MYTHICAL) {
			const maxRarity = upgradeStation.maxUpgradeableRarity;
			lines.push(i18n.t("commands:report.city.homes.upgradeStation.rarityLimitation", {
				lng: ctx.lng,
				maxRarity
			}));
		}

		return lines.join("\n");
	}

	public getSubMenuTitle(ctx: HomeFeatureHandlerContext, pseudo: string): string {
		return i18n.t("commands:report.city.homes.upgradeStation.title", {
			lng: ctx.lng,
			pseudo
		});
	}
}
