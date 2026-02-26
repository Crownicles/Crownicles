/**
 * Constants related to map location types used throughout the game world.
 * These string codes identify the type of terrain/location for a map location.
 */
export abstract class MapLocationConstants {
	/**
	 * Map location type codes as used in the game's data files and database.
	 * These match the "type" field in Core/resources/mapLocations/*.json.
	 */
	static readonly TYPES = {
		BEACH: "be",
		BLESSED_DOORS: "blessedDoors",
		CASTLE_ENTRANCE: "castleEntrance",
		CASTLE_THRONE: "castleThrone",
		CITY: "ci",
		CONTINENT: "continent",
		CRYSTAL_CAVERN: "crystalCavern",
		DESERT: "de",
		DRAGONS_NEST: "dragonsNest",
		FOREST: "fo",
		HAUNTED_HOUSE: "hauntedHouse",
		ICE_BEACH: "iceBeach",
		ICE_PEAK: "icePeak",
		LAKE: "la",
		MINE: "mine",
		MISTY_PATH: "mistyPath",
		MOUNTAIN: "mo",
		PLAINS: "pl",
		PVE_EXIT: "pveExit",
		RIVER: "ri",
		ROAD: "ro",
		RUINS: "ruins",
		TEST_ZONE: "testZone",
		TUNDRA: "tundra",
		UNDERGROUND_LAKE: "undergroundLake",
		VILLAGE: "vi",
		VOLCANO: "volcano"
	} as const;
}
