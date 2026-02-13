import {
	HomeFeatureHandler, HomeFeatureHandlerContext, HomeFeatureMenuOption
} from "./HomeMenuTypes";
import { UpgradeStationFeatureHandler } from "./UpgradeStationFeatureHandler";
import { BedFeatureHandler } from "./BedFeatureHandler";
import { ChestFeatureHandler } from "./features/ChestFeatureHandler";
import { CrowniclesNestedMenus } from "../../../../messages/CrowniclesNestedMenus";
import { StringSelectMenuInteraction } from "discord.js";

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
			return option && option.value === value;
		});
	}

	/**
	 * Get all menu options for available features
	 */
	public getMenuOptions(ctx: HomeFeatureHandlerContext): HomeFeatureMenuOption[] {
		return this.handlers
			.map(handler => handler.getMenuOption(ctx))
			.filter((option): option is HomeFeatureMenuOption => option !== null);
	}

	/**
	 * Get all description lines from available features
	 */
	public getDescriptionLines(ctx: HomeFeatureHandlerContext): string[] {
		return this.handlers.flatMap(handler => handler.getDescriptionLines(ctx));
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
 * - ChestFeatureHandler: Store backup items ✅ (registered)
 * - PotionCraftingFeatureHandler: Craft potions
 * - GardenFeatureHandler: Cultivate plants
 */
export const homeFeatureRegistry = new HomeFeatureRegistry()
	.register(new UpgradeStationFeatureHandler())
	.register(new BedFeatureHandler())
	.register(new ChestFeatureHandler());
