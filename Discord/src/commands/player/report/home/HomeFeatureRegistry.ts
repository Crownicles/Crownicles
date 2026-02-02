import {
	HomeFeatureHandler, HomeFeatureHandlerContext, HomeFeatureMenuOption
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
	 * Get all handlers
	 */
	public getHandlers(): HomeFeatureHandler[] {
		return this.handlers;
	}

	/**
	 * Get all available handlers for the given context
	 */
	public getAvailableHandlers(ctx: HomeFeatureHandlerContext): HomeFeatureHandler[] {
		return this.handlers.filter(handler => handler.isAvailable(ctx));
	}

	/**
	 * Get a handler by feature ID
	 */
	public getHandler(featureId: string): HomeFeatureHandler | undefined {
		return this.handlers.find(h => h.featureId === featureId);
	}

	/**
	 * Get handler by menu value
	 */
	public getHandlerByMenuValue(ctx: HomeFeatureHandlerContext, value: string): HomeFeatureHandler | undefined {
		return this.handlers.find(handler => {
			const option = handler.getMenuOption(ctx);
			return option?.value === value;
		});
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
	 * Get all menu options for the main home menu
	 */
	public getMenuOptions(ctx: HomeFeatureHandlerContext): HomeFeatureMenuOption[] {
		const options: HomeFeatureMenuOption[] = [];

		for (const handler of this.handlers) {
			const option = handler.getMenuOption(ctx);
			if (option) {
				options.push(option);
			}
		}

		return options;
	}

	/**
	 * Add all sub-menu options from a specific handler
	 */
	public addSubMenuOptions(handler: HomeFeatureHandler, ctx: HomeFeatureHandlerContext, selectMenu: StringSelectMenuBuilder): void {
		handler.addSubMenuOptions(ctx, selectMenu);
	}

	/**
	 * Handle selection from main home menu
	 */
	public async handleMainMenuSelection(
		ctx: HomeFeatureHandlerContext,
		selectedValue: string,
		selectInteraction: StringSelectMenuInteraction,
		nestedMenus: CrowniclesNestedMenus
	): Promise<boolean> {
		const handler = this.getHandlerByMenuValue(ctx, selectedValue);

		if (handler) {
			await handler.handleFeatureSelection(ctx, selectInteraction, nestedMenus);
			return true;
		}

		return false;
	}

	/**
	 * Handle selection from a feature's sub-menu
	 */
	public handleSubMenuSelection(
		handler: HomeFeatureHandler,
		ctx: HomeFeatureHandlerContext,
		selectedValue: string,
		selectInteraction: StringSelectMenuInteraction,
		nestedMenus: CrowniclesNestedMenus
	): Promise<boolean> {
		return handler.handleSubMenuSelection(ctx, selectedValue, selectInteraction, nestedMenus);
	}
}

/**
 * Singleton registry instance with all home features registered.
 *
 * To add a new home feature:
 * 1. Create a new handler class implementing HomeFeatureHandler
 * 2. Register it here with .register(new YourHandler())
 *
 * Future features to implement:
 * - BedFeatureHandler: Rest to recover health
 * - ChestFeatureHandler: Store backup items
 * - PotionCraftingFeatureHandler: Craft potions
 * - GardenFeatureHandler: Cultivate plants
 */
export const homeFeatureRegistry = new HomeFeatureRegistry()
	.register(new UpgradeStationFeatureHandler());
