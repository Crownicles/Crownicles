/**
 * Home menu module for managing player home features in cities.
 *
 * Architecture:
 * - HomeMenuTypes.ts: Interfaces and types for the home feature system
 * - HomeFeatureRegistry.ts: Registry of all available home features
 * - HomeMenu.ts: Main menu builder using the registry
 * - Feature handlers: Individual handlers for each home feature
 *
 * To add a new home feature:
 * 1. Create a new handler file implementing HomeFeatureHandler
 * 2. Register it in HomeFeatureRegistry.ts
 * 3. Add any necessary reactions in Lib/src/packets/interaction/ReactionCollectorCity.ts
 * 4. Add backend handling in Core/src/commands/player/ReportCommand.ts
 */

export { getHomeMenu } from "./HomeMenu";
export { homeFeatureRegistry } from "./HomeFeatureRegistry";
export type {
	HomeFeatureHandler, HomeFeatureHandlerContext
} from "./HomeMenuTypes";
