import {
	HomeFeatureHandler, HomeFeatureHandlerContext
} from "./HomeMenuTypes";
import { UpgradeStationFeatureHandler } from "./UpgradeStationFeatureHandler";
import { CrowniclesNestedMenus } from "../../../../messages/CrowniclesNestedMenus";
import {
	StringSelectMenuBuilder, StringSelectMenuInteraction
} from "discord.js";

/**
 * Registry for all home feature handlers.
 * New features should be added here.
 */
class HomeFeatureRegistry {
	private handlers: HomeFeatureHandler[] = [];

	/**
	 * Register a new feature handler
	 */
	public register(handler: HomeFeatureHandler): this {
		this.handlers.push(handler);
		return this;
	}

	/**
	 * Get all available handlers for the given context
	 */
	public getAvailableHandlers(ctx: HomeFeatureHandlerContext): HomeFeatureHandler[] {
		return this.handlers.filter(handler => handler.isAvailable(ctx));
	}

	/**
	 * Build combined description from all available handlers
	 */
	public buildDescription(ctx: HomeFeatureHandlerContext): string[] {
		const lines: string[] = [];

		for (const handler of this.getAvailableHandlers(ctx)) {
			lines.push(...handler.getDescriptionLines(ctx));
		}

		return lines;
	}

	/**
	 * Add all menu options from available handlers
	 */
	public addAllMenuOptions(ctx: HomeFeatureHandlerContext, selectMenu: StringSelectMenuBuilder): void {
		for (const handler of this.getAvailableHandlers(ctx)) {
			handler.addMenuOptions(ctx, selectMenu);
		}
	}

	/**
	 * Try to handle a selection with all registered handlers.
	 * Returns true if any handler processed the selection.
	 */
	public async handleSelection(
		ctx: HomeFeatureHandlerContext,
		selectedValue: string,
		selectInteraction: StringSelectMenuInteraction,
		nestedMenus: CrowniclesNestedMenus
	): Promise<boolean> {
		for (const handler of this.handlers) {
			if (await handler.handleSelection(ctx, selectedValue, selectInteraction, nestedMenus)) {
				return true;
			}
		}

		return false;
	}
}

/**
 * Singleton registry instance with all home features registered.
 *
 * To add a new home feature:
 * 1. Create a new handler class implementing HomeFeatureHandler
 * 2. Register it here with .register(new YourFeatureHandler())
 *
 * Future features to implement:
 * - BedFeatureHandler: Rest to recover health
 * - ChestFeatureHandler: Store backup items
 * - PotionCraftingFeatureHandler: Craft potions
 * - GardenFeatureHandler: Cultivate plants
 */
export const homeFeatureRegistry = new HomeFeatureRegistry()
	.register(new UpgradeStationFeatureHandler());

/*
 * Future handlers to add:
 * .register(new BedFeatureHandler())
 * .register(new ChestFeatureHandler())
 * .register(new PotionCraftingFeatureHandler())
 * .register(new GardenFeatureHandler())
 */
