import {
	StringSelectMenuBuilder, StringSelectMenuInteraction
} from "discord.js";
import { Language } from "../../../../../../Lib/src/Language";
import { ReactionCollectorCityData } from "../../../../../../Lib/src/packets/interaction/ReactionCollectorCity";
import { CrowniclesNestedMenus } from "../../../../messages/CrowniclesNestedMenus";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import { ReactionCollectorCreationPacket } from "../../../../../../Lib/src/packets/interaction/ReactionCollectorPacket";

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
	 * Get description lines to add to the home menu embed
	 */
	getDescriptionLines(ctx: HomeFeatureHandlerContext): string[];

	/**
	 * Add options to the select menu for this feature
	 */
	addMenuOptions(ctx: HomeFeatureHandlerContext, selectMenu: StringSelectMenuBuilder): void;

	/**
	 * Handle selection from the menu. Returns true if the selection was handled.
	 */
	handleSelection(
		ctx: HomeFeatureHandlerContext,
		selectedValue: string,
		selectInteraction: StringSelectMenuInteraction,
		nestedMenus: CrowniclesNestedMenus
	): Promise<boolean>;
}
