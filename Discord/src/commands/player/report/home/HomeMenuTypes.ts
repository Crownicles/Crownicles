import {
	ButtonInteraction, StringSelectMenuBuilder, StringSelectMenuInteraction
} from "discord.js";
import { Language } from "../../../../../../Lib/src/Language";
import { ReactionCollectorCityData } from "../../../../../../Lib/src/packets/interaction/ReactionCollectorCity";
import { CrowniclesNestedMenus } from "../../../../messages/CrowniclesNestedMenus";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import { ReactionCollectorCreationPacket } from "../../../../../../Lib/src/packets/interaction/ReactionCollectorPacket";

/**
 * Union type for component interactions (select menu or button)
 */
export type ComponentInteraction = StringSelectMenuInteraction | ButtonInteraction;

/**
 * Data needed by home feature handlers
 */
export interface HomeFeatureHandlerContext {
	context: PacketContext;
	packet: ReactionCollectorCreationPacket;
	homeData: NonNullable<ReactionCollectorCityData["home"]["owned"]>;
	lng: Language;
}

/**
 * Option to display in the main home menu for a feature
 */
export interface HomeFeatureMenuOption {
	label: string;
	description?: string;
	emoji: string;
	value: string;
}

/**
 * Interface for home feature handlers.
 * Each home feature (upgrade station, potion crafting, bed, chest, garden) should implement this.
 */
export interface HomeFeatureHandler {

	/**
	 * Unique identifier for this feature
	 */
	readonly featureId: string;

	/**
	 * Check if this feature is available for the current home
	 */
	isAvailable(ctx: HomeFeatureHandlerContext): boolean;

	/**
	 * Get the menu option to show in the main home menu.
	 * Returns null if the feature should not show an option.
	 */
	getMenuOption(ctx: HomeFeatureHandlerContext): HomeFeatureMenuOption | null;

	/**
	 * Get description lines to show in the main home menu
	 */
	getDescriptionLines(ctx: HomeFeatureHandlerContext): string[];

	/**
	 * Handle when the user selects this feature from the main menu.
	 * This should typically open a sub-menu with detailed options.
	 */
	handleFeatureSelection(
		ctx: HomeFeatureHandlerContext,
		selectInteraction: StringSelectMenuInteraction,
		nestedMenus: CrowniclesNestedMenus
	): Promise<void>;

	/**
	 * Handle selection within the feature's sub-menu.
	 * Returns true if the selection was handled.
	 */
	handleSubMenuSelection(
		ctx: HomeFeatureHandlerContext,
		selectedValue: string,
		componentInteraction: ComponentInteraction,
		nestedMenus: CrowniclesNestedMenus
	): Promise<boolean>;

	/**
	 * Add options to the feature's sub-menu
	 */
	addSubMenuOptions(ctx: HomeFeatureHandlerContext, selectMenu: StringSelectMenuBuilder): void;

	/**
	 * Get the sub-menu description
	 */
	getSubMenuDescription(ctx: HomeFeatureHandlerContext): string;

	/**
	 * Get the sub-menu title
	 */
	getSubMenuTitle(ctx: HomeFeatureHandlerContext, pseudo: string): string;
}
