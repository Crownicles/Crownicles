import {
	StringSelectMenuBuilder, StringSelectMenuInteraction
} from "discord.js";
import {
	HomeFeatureHandler, HomeFeatureHandlerContext
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

	private static readonly MENU_OPTION_PREFIX = "UPGRADE_ITEM_";

	public isAvailable(ctx: HomeFeatureHandlerContext): boolean {
		// Available if the home has an upgrade station (upgradeItemMaximumRarity > BASIC means it has one)
		return ctx.homeData.features.upgradeItemMaximumRarity > ItemRarity.BASIC
			|| Boolean(ctx.homeData.upgradeStation);
	}

	public getDescriptionLines(ctx: HomeFeatureHandlerContext): string[] {
		const {
			homeData, lng
		} = ctx;
		const upgradeStation = homeData.upgradeStation;

		if (!upgradeStation) {
			return [];
		}

		if (upgradeStation.upgradeableItems.length > 0) {
			return [i18n.t("commands:report.city.homes.upgradeStationAvailable", { lng })];
		}

		return [i18n.t("commands:report.city.homes.upgradeStationNoItems", { lng })];
	}

	public addMenuOptions(ctx: HomeFeatureHandlerContext, selectMenu: StringSelectMenuBuilder): void {
		const {
			homeData, lng
		} = ctx;
		const upgradeStation = homeData.upgradeStation;

		if (!upgradeStation) {
			return;
		}

		for (let i = 0; i < upgradeStation.upgradeableItems.length; i++) {
			const item = upgradeStation.upgradeableItems[i];

			// Set maxValue to Infinity to not display max values in stats
			item.details.attack.maxValue = Infinity;
			item.details.defense.maxValue = Infinity;
			item.details.speed.maxValue = Infinity;

			const itemDisplay = DisplayUtils.getItemDisplayWithStats(item.details, lng);
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
				value: `${UpgradeStationFeatureHandler.MENU_OPTION_PREFIX}${i}`,
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

	public async handleSelection(
		ctx: HomeFeatureHandlerContext,
		selectedValue: string,
		selectInteraction: StringSelectMenuInteraction,
		_nestedMenus: CrowniclesNestedMenus
	): Promise<boolean> {
		const {
			context, packet, homeData
		} = ctx;
		const upgradeStation = homeData.upgradeStation;

		if (!selectedValue.startsWith(UpgradeStationFeatureHandler.MENU_OPTION_PREFIX) || !upgradeStation) {
			return false;
		}

		await selectInteraction.deferReply();

		const index = parseInt(selectedValue.replace(UpgradeStationFeatureHandler.MENU_OPTION_PREFIX, ""), 10);

		if (index < 0 || index >= upgradeStation.upgradeableItems.length) {
			return true; // Handled but invalid index
		}

		const slot = upgradeStation.upgradeableItems[index].slot;
		const itemCategory = upgradeStation.upgradeableItems[index].category;

		const reactionIndex = packet.reactions.findIndex(
			reaction => reaction.type === ReactionCollectorUpgradeItemReaction.name
				&& (reaction.data as ReactionCollectorUpgradeItemReaction).slot === slot
				&& (reaction.data as ReactionCollectorUpgradeItemReaction).itemCategory === itemCategory
		);

		if (reactionIndex !== -1) {
			DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, selectInteraction, reactionIndex);
		}

		return true;
	}
}
