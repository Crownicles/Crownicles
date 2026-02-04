/**
 * Home menu module for managing player home features in cities.
 *
 * Architecture:
 * - HomeMenuTypes.ts: Interfaces and types for the home feature system
 * - HomeFeatureRegistry.ts: Registry of all available home features
 * - HomeMenu.ts: Main menu builder + sub-menu generator
 * - HomeMenuConstants.ts: Constants for menu IDs and thresholds
 * - Feature handlers: Individual handlers for each home feature
 *
 * To add a new home feature:
 * 1. Create a new handler file implementing HomeFeatureHandler
 * 2. Register it in HomeFeatureRegistry.ts
 * 3. Add any necessary reactions in Lib/src/packets/interaction/ReactionCollectorCity.ts
 * 4. Add backend handling in Core/src/commands/player/ReportCommand.ts
 * 5. Add translations in Lang/fr/commands.json
 */

export {
	getHomeMenu, getHomeSubMenus
} from "./HomeMenu";
export { homeFeatureRegistry } from "./HomeFeatureRegistry";
export {
	HomeMenuIds, ADVANCED_UPGRADE_LEVEL_THRESHOLD
} from "./HomeMenuConstants";
export type {
	HomeFeatureHandler, HomeFeatureHandlerContext
} from "./HomeMenuTypes";
