import {
	StringSelectMenuBuilder, StringSelectMenuInteraction
} from "discord.js";
import {
	HomeFeatureHandler, HomeFeatureHandlerContext, HomeFeatureMenuOption
} from "./HomeMenuTypes";
import { CrowniclesNestedMenus } from "../../../../messages/CrowniclesNestedMenus";
import i18n from "../../../../translations/i18n";
import { DisplayUtils } from "../../../../utils/DisplayUtils";
import { CrowniclesIcons } from "../../../../../../Lib/src/CrowniclesIcons";
import { ReactionCollectorUpgradeItemReaction } from "../../../../../../Lib/src/packets/interaction/ReactionCollectorCity";
import { DiscordCollectorUtils } from "../../../../utils/DiscordCollectorUtils";
import { ItemRarity } from "../../../../../../Lib/src/constants/ItemConstants";

/**
 * Handler for the upgrade station feature in the home.
 * Allows players to upgrade their equipment using materials.
 */
export class UpgradeStationFeatureHandler implements HomeFeatureHandler {
	public readonly featureId = "upgradeStation";

	private static readonly MENU_VALUE = "HOME_UPGRADE_STATION";

	private static readonly ITEM_PREFIX = "UPGRADE_ITEM_";

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
		selectInteraction: StringSelectMenuInteraction,
		nestedMenus: CrowniclesNestedMenus
	): Promise<boolean> {
		// Handle back to home menu
		if (selectedValue === "BACK_TO_HOME") {
			await selectInteraction.deferUpdate();
			await nestedMenus.changeMenu("HOME_MENU");
			return true;
		}

		// Handle item upgrade selection
		if (!selectedValue.startsWith(UpgradeStationFeatureHandler.ITEM_PREFIX)) {
			return false;
		}

		const upgradeStation = ctx.homeData.upgradeStation;
		if (!upgradeStation) {
			return false;
		}

		await selectInteraction.deferReply();

		const index = parseInt(selectedValue.replace(UpgradeStationFeatureHandler.ITEM_PREFIX, ""), 10);

		if (index < 0 || index >= upgradeStation.upgradeableItems.length) {
			return true; // Handled but invalid index
		}

		const slot = upgradeStation.upgradeableItems[index].slot;
		const itemCategory = upgradeStation.upgradeableItems[index].category;

		const reactionIndex = ctx.packet.reactions.findIndex(
			reaction => reaction.type === ReactionCollectorUpgradeItemReaction.name
				&& (reaction.data as ReactionCollectorUpgradeItemReaction).slot === slot
				&& (reaction.data as ReactionCollectorUpgradeItemReaction).itemCategory === itemCategory
		);

		if (reactionIndex !== -1) {
			DiscordCollectorUtils.sendReaction(ctx.packet, ctx.context, ctx.context.keycloakId!, selectInteraction, reactionIndex);
		}

		return true;
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

			// Build material requirement string with icons
			const materialReqs = item.requiredMaterials.map(mat =>
				`${CrowniclesIcons.materials[mat.materialId] ?? "❓"} ${mat.playerQuantity}/${mat.quantity}`).join(" ");

			// Format: current level → next level | material requirements
			let rawDescription = `+${item.details.itemLevel} → +${item.nextLevel} | ${materialReqs}`;

			// Mark with ❌ if player can't upgrade (missing materials)
			if (!item.canUpgrade) {
				rawDescription = `❌ ${rawDescription}`;
			}

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
				})
			};

			// Truncate description if too long (Discord limit: 100 chars)
			if (rawDescription) {
				option.description = rawDescription.length > 100
					? `${rawDescription.slice(0, 99)}…`
					: rawDescription;
			}

			selectMenu.addOptions(option);
		}
	}

	public getSubMenuDescription(ctx: HomeFeatureHandlerContext): string {
		const upgradeStation = ctx.homeData.upgradeStation;

		if (!upgradeStation || upgradeStation.upgradeableItems.length === 0) {
			return i18n.t("commands:report.city.homes.upgradeStation.noItems", { lng: ctx.lng });
		}

		return i18n.t("commands:report.city.homes.upgradeStation.selectItem", { lng: ctx.lng });
	}

	public getSubMenuTitle(ctx: HomeFeatureHandlerContext, pseudo: string): string {
		return i18n.t("commands:report.city.homes.upgradeStation.title", {
			lng: ctx.lng,
			pseudo
		});
	}
}
