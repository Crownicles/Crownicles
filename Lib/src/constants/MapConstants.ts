export abstract class MapConstants {
	static readonly MAP_URL = "https://crownicles.com/public/ressources/map.jpg";

	static readonly MAP_URL_WITH_CURSOR = "https://crownicles.com/public/ressources/mapsCursed/{mapLink}map.jpg";

	static readonly FORCED_MAPS_URL = "https://crownicles.com/public/ressources/maps/{name}.jpg";

	static readonly WATER_MAP_LINKS = [
		1,
		2,
		17,
		20,
		21,
		22,
		23,
		24,
		32,
		33,
		34,
		36,
		37,
		40,
		41,
		42,
		43,
		44,
		46,
		47,
		49,
		54,
		55,
		56,
		57,
		59
	];

	static readonly LOCATIONS_IDS = {
		SENTINEL_BEACH: 1,
		RURAL_PATH: 2,
		THE_CRADLE: 3,
		OLDSTER_FOREST: 4,
		DAEDALUS_PATH: 5,
		BOUG_COTON: 6,
		KING_VALLEY: 7,
		CROSSROADS_OF_FATES: 8,
		MAIN_ROAD: 9,
		VILLE_FORTE: 10,
		GREAT_ROAD: 11,
		THE_EXTENT: 12,
		MARSHY_ROAD: 13,
		MIRAGE_LAKE: 14,
		MOUNT_CELESTRUM: 15,
		WOLVES_PATH: 16,
		COCO_VILLAGE: 17,
		VACARME_RIVER: 18,
		THE_DUNE: 19,
		BACKWOODS_PLAINS: 20,
		ROAD_OF_WONDERS: 21,
		HOWLING_WOODS: 22,
		CLAIRE_DE_VILLE: 23,
		CLIMBING_ROAD: 24,
		CRAB_RIVER: 25,
		SEAWYNNE: 26,
		CELESTRUM_FOREST: 27,
		CASTLE_ENTRANCE: 28,
		RECEPTION_ROOM: 29,
		ROAD_TO_THE_KING_CASTLE: 32,
		CASTLE_COURTYARD: 41
	};


	static readonly MAP_ATTRIBUTES = {
		CONTINENT1: "continent1",
		KING_CASTLE: "king_castle",
		MAIN_CONTINENT: "main_continent",
		PVE_EXIT: "pve_exit",
		PVE_ISLAND_ENTRY: "pve_island_entry",
		PVE_ISLAND: "pve_island",
		HAUNTED: "haunted"
	};
}
