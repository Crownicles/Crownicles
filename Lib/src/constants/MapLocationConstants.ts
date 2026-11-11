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
		ABYSS: "abyss",
		BEACH: "be",
		BLESSED_DOORS: "blessedDoors",
		CANOPY: "canopy",
		CASTLE_ENTRANCE: "castleEntrance",
		CASTLE_THRONE: "castleThrone",
		CAVERN: "cavern",
		CITY: "ci",
		CONTINENT: "continent",
		CREEK: "creek",
		CRYSTAL_CAVERN: "crystalCavern",
		DELTA: "delta",
		DESERT: "de",
		DRAGONS_NEST: "dragonsNest",
		FOREST: "fo",
		FUNGAL_GROVE: "fungalGrove",
		HAUNTED_HOUSE: "hauntedHouse",
		HOLLOW_TRUNK: "hollowTrunk",
		ICE_BEACH: "iceBeach",
		ICE_PEAK: "icePeak",
		LAKE: "la",
		MANGROVE: "mangrove",
		MINE: "mine",
		MISTY_PATH: "mistyPath",
		MOTHER_TREE_HEART: "motherTreeHeart",
		MOUNTAIN: "mo",
		PEAT_BOG: "peatBog",
		PLAINS: "pl",
		PVE_EXIT: "pveExit",
		RIVER: "ri",
		ROAD: "ro",
		RUINS: "ruins",
		TEST_ZONE: "testZone",
		TUNDRA: "tundra",
		TWISTED_ROOTS: "twistedRoots",
		UNDERGROUND_LAKE: "undergroundLake",
		VILLAGE: "vi",
		VOLCANO: "volcano"
	} as const;
}

export type MapLocationType = typeof MapLocationConstants.TYPES[keyof typeof MapLocationConstants.TYPES];
