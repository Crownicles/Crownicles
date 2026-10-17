import type { ExpeditionLocationType } from "../constants/ExpeditionConstants";

/**
 * Terrain of a map location (forest, cave, coast...). It drives the expeditions, the material loot
 * found while travelling and the pet food, independently of the structural type of the location.
 */
export type Biome = ExpeditionLocationType;
