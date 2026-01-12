import type { ExpeditionLocationType } from "./ExpeditionConstants";

/**
 * Pet expedition preference type
 */
export type PetExpeditionPreference = "liked" | "neutral" | "disliked";

/**
 * Pet expedition preference configuration
 */
export interface PetExpeditionPreferenceConfig {
	liked: ExpeditionLocationType[];
	disliked: ExpeditionLocationType[];
}

/**
 * Reward multipliers based on pet preference for expedition location
 */
export const PET_PREFERENCE_REWARD_MULTIPLIERS: Record<PetExpeditionPreference, number> = {
	liked: 1,
	neutral: 0.8,
	disliked: 0.25
};

/**
 * Additional failure risk for disliked expeditions shorter than 12 hours
 */
export const DISLIKED_SHORT_EXPEDITION_FAILURE_BONUS = 10;

/**
 * Failure risk reduction bonus for liked expeditions
 */
export const LIKED_EXPEDITION_FAILURE_REDUCTION = 5;

/**
 * Threshold duration in minutes below which disliked expeditions have extra failure risk
 */
export const DISLIKED_EXPEDITION_DURATION_THRESHOLD_MINUTES = 720; // 12 hours

/**
 * Pet expedition preferences by pet type ID
 * Each pet has preferred (liked) and disliked expedition location types
 * Locations not in either list are considered neutral
 *
 * Preferences are based purely on RP (natural habitat and animal behavior):
 * - 1 to 4 liked locations per pet
 * - 0 to 2 disliked locations per pet
 */
export const PET_EXPEDITION_PREFERENCES: Record<number, PetExpeditionPreferenceConfig> = {
	// 0 - No pet (default neutral)
	0: {
		liked: [], disliked: []
	},

	/*
	 * ===== CANINES =====
	 * Dog - Loyal companion, adaptable to most terrains
	 */
	1: {
		liked: [
			"forest",
			"plains",
			"mountain"
		],
		disliked: ["swamp"]
	},

	// Poodle - Elegant pet, prefers civilized or mild terrains
	2: {
		liked: [
			"plains",
			"ruins"
		],
		disliked: ["swamp", "cave"]
	},

	// Fox - Forest dweller, cunning and adaptable
	20: {
		liked: [
			"forest",
			"plains"
		],
		disliked: ["desert"]
	},

	// Wolf - Wild pack hunter, thrives in wilderness
	28: {
		liked: [
			"forest",
			"mountain",
			"plains"
		],
		disliked: ["desert"]
	},

	/*
	 * ===== FELINES =====
	 * Cat - Curious explorer, loves mysterious and cozy places
	 */
	3: {
		liked: [
			"ruins",
			"forest",
			"plains"
		],
		disliked: ["swamp"]
	},

	// Black cat - Mysterious, thrives in shadows and ancient places
	4: {
		liked: [
			"ruins",
			"cave",
			"forest"
		],
		disliked: ["desert"]
	},

	// Tiger - Jungle apex predator, needs dense cover
	56: {
		liked: [
			"forest",
			"swamp"
		],
		disliked: ["desert", "coast"]
	},

	// Lion - Savanna king, open terrain hunter
	57: {
		liked: [
			"plains",
			"desert"
		],
		disliked: ["swamp", "forest"]
	},

	// Leopard - Versatile big cat, climber
	60: {
		liked: [
			"forest",
			"mountain"
		],
		disliked: ["coast"]
	},

	/*
	 * ===== RODENTS =====
	 * Mouse - Small and adaptable, hides anywhere
	 */
	5: {
		liked: [
			"plains",
			"cave",
			"ruins"
		],
		disliked: []
	},

	// Hamster - Burrow dweller, loves dry places
	6: {
		liked: [
			"plains",
			"desert",
			"cave"
		],
		disliked: ["swamp"]
	},

	// Rabbit - Meadow creature, fast runner
	7: {
		liked: [
			"plains",
			"forest"
		],
		disliked: ["desert", "swamp"]
	},

	// Raccoon - Clever scavenger, loves civilization remnants
	35: {
		liked: [
			"forest",
			"ruins"
		],
		disliked: ["desert"]
	},

	// Chipmunk - Forest floor dweller
	40: {
		liked: [
			"forest",
			"mountain"
		],
		disliked: ["desert", "coast"]
	},

	// Hedgehog - Woodland creature
	41: {
		liked: [
			"forest",
			"plains"
		],
		disliked: ["desert"]
	},

	// Rat - Ultimate survivor, thrives in ruins
	93: {
		liked: [
			"ruins",
			"cave",
			"swamp"
		],
		disliked: []
	},

	/*
	 * ===== FARM ANIMALS =====
	 * Cow - Pastoral grazer, needs open fields
	 */
	8: {
		liked: [
			"plains",
			"forest"
		],
		disliked: ["mountain", "desert"]
	},

	// Pig - Forager, loves mud and forests
	9: {
		liked: [
			"plains",
			"forest",
			"swamp"
		],
		disliked: ["desert"]
	},

	// Sheep - Mountain grazer, fluffy
	17: {
		liked: [
			"plains",
			"mountain"
		],
		disliked: ["swamp", "desert"]
	},

	// Goat - Sure-footed climber, explores ruins
	18: {
		liked: [
			"mountain",
			"ruins",
			"plains"
		],
		disliked: ["swamp"]
	},

	// Donkey - Hardy pack animal, versatile
	96: {
		liked: [
			"plains",
			"mountain",
			"desert"
		],
		disliked: ["swamp"]
	},

	/*
	 * ===== POULTRY =====
	 * Chicken - Farm bird, stays near settlements
	 */
	10: {
		liked: [
			"plains",
			"forest"
		],
		disliked: ["mountain", "cave"]
	},

	// Duck - Waterfowl, loves wetlands
	12: {
		liked: [
			"coast",
			"swamp",
			"plains"
		],
		disliked: ["desert", "cave"]
	},

	// Turkey - Forest ground bird
	19: {
		liked: [
			"forest",
			"plains"
		],
		disliked: ["desert", "coast"]
	},

	// Chick - Baby bird, fragile
	92: {
		liked: [
			"plains",
			"forest"
		],
		disliked: [
			"mountain",
			"swamp"
		]
	},

	// Goose - Aggressive waterfowl
	97: {
		liked: [
			"plains",
			"coast",
			"swamp"
		],
		disliked: ["desert", "cave"]
	},

	/*
	 * ===== BIRDS =====
	 * Bird - Generic songbird, forest dweller
	 */
	11: {
		liked: [
			"forest",
			"plains",
			"mountain"
		],
		disliked: ["cave"]
	},

	// Owl - Nocturnal hunter, forest and darkness
	26: {
		liked: [
			"forest",
			"ruins",
			"cave"
		],
		disliked: ["desert"]
	},

	// Bat - Cave dweller, nocturnal
	27: {
		liked: [
			"cave",
			"ruins",
			"forest"
		],
		disliked: ["desert", "plains"]
	},

	// Swan - Elegant water bird
	33: {
		liked: [
			"coast",
			"swamp",
			"plains"
		],
		disliked: ["desert", "cave"]
	},

	// Flamingo - Wetland specialist
	34: {
		liked: [
			"coast",
			"swamp"
		],
		disliked: ["cave", "desert"]
	},

	// Peacock - Forest display bird
	53: {
		liked: [
			"forest",
			"ruins",
			"plains"
		],
		disliked: ["desert"]
	},

	// Parrot - Tropical rainforest bird
	54: {
		liked: [
			"forest",
			"coast",
			"ruins"
		],
		disliked: ["mountain", "desert"]
	},

	// Eagle - Mountain apex predator, soars high
	58: {
		liked: [
			"mountain",
			"plains"
		],
		disliked: ["cave", "swamp"]
	},

	// Dove - Peaceful bird, near civilization
	62: {
		liked: [
			"plains",
			"forest",
			"ruins"
		],
		disliked: ["cave"]
	},

	// Blackbird - Common forest bird
	94: {
		liked: [
			"forest",
			"plains",
			"ruins"
		],
		disliked: ["desert"]
	},

	// Crow - Intelligent scavenger, loves mysteries
	95: {
		liked: [
			"ruins",
			"forest",
			"plains"
		],
		disliked: []
	},

	// Dodo - Extinct island bird, tropical
	59: {
		liked: [
			"forest",
			"coast",
			"plains"
		],
		disliked: ["mountain", "cave"]
	},

	/*
	 * ===== EQUINES =====
	 * Horse - Open terrain runner, dislikes confined spaces
	 */
	13: {
		liked: [
			"plains",
			"mountain"
		],
		disliked: ["swamp", "cave"]
	},

	// Zebra - African savanna specialist
	47: {
		liked: [
			"plains",
			"desert"
		],
		disliked: ["swamp", "forest"]
	},

	// Elk - Forest and mountain dweller
	98: {
		liked: [
			"forest",
			"mountain"
		],
		disliked: ["desert", "coast"]
	},

	/*
	 * ===== REPTILES =====
	 * Turtle - Slow, loves water and beaches
	 */
	14: {
		liked: [
			"coast",
			"swamp",
			"plains"
		],
		disliked: ["desert", "mountain"]
	},

	// Snake - Desert and swamp adapted, cold-blooded
	15: {
		liked: [
			"desert",
			"swamp",
			"ruins"
		],
		disliked: ["mountain"]
	},

	// Lizard - Desert basker, cave explorer
	16: {
		liked: [
			"desert",
			"ruins",
			"cave"
		],
		disliked: ["swamp"]
	},

	// Scorpion - Desert specialist
	44: {
		liked: [
			"desert",
			"cave",
			"ruins"
		],
		disliked: ["coast", "swamp"]
	},

	// Crocodile - Apex swamp predator
	45: {
		liked: [
			"swamp",
			"coast"
		],
		disliked: ["desert", "mountain"]
	},

	/*
	 * ===== BEARS =====
	 * Bear - Forest and mountain omnivore
	 */
	21: {
		liked: [
			"forest",
			"mountain",
			"cave"
		],
		disliked: ["desert"]
	},

	// Polar bear - Arctic specialist
	42: {
		liked: [
			"coast",
			"mountain"
		],
		disliked: ["desert", "swamp"]
	},

	// Panda - Bamboo forest specialist
	43: {
		liked: [
			"forest",
			"mountain"
		],
		disliked: ["desert", "coast"]
	},

	/*
	 * ===== AMPHIBIANS =====
	 * Frog - Wetland creature, needs moisture
	 */
	23: {
		liked: [
			"swamp",
			"coast",
			"forest"
		],
		disliked: ["desert", "mountain"]
	},

	/*
	 * ===== PRIMATES =====
	 * Monkey - Forest canopy dweller
	 */
	24: {
		liked: [
			"forest",
			"ruins"
		],
		disliked: ["desert", "coast"]
	},

	// Orangutan - Rainforest specialist
	90: {
		liked: [
			"forest",
			"swamp"
		],
		disliked: ["desert", "mountain"]
	},

	// Gorilla - Dense forest dweller
	91: {
		liked: [
			"forest",
			"mountain"
		],
		disliked: ["desert", "coast"]
	},

	/*
	 * ===== ARCTIC ANIMALS =====
	 * Penguin - Cold coast specialist
	 */
	25: {
		liked: [
			"coast",
			"mountain"
		],
		disliked: ["desert", "swamp"]
	},

	// Emperor Penguin - Antarctic specialist
	72: {
		liked: [
			"coast",
			"mountain"
		],
		disliked: ["desert", "swamp"]
	},

	// Seal - Marine mammal, coast caves
	30: {
		liked: [
			"coast",
			"cave"
		],
		disliked: ["desert", "forest"]
	},

	/*
	 * ===== AUSTRALIAN =====
	 * Koala - Tree hugger, eucalyptus lover
	 */
	22: {
		liked: ["forest"],
		disliked: ["desert", "cave"]
	},

	// Kangaroo - Outback hopper
	52: {
		liked: [
			"plains",
			"desert"
		],
		disliked: ["cave", "swamp"]
	},

	/*
	 * ===== AFRICAN SAVANNA =====
	 * Hippo - River and wetland giant
	 */
	31: {
		liked: [
			"swamp",
			"coast"
		],
		disliked: ["desert", "mountain"]
	},

	// Elephant - Savanna and forest giant
	46: {
		liked: [
			"plains",
			"forest"
		],
		disliked: ["cave", "mountain"]
	},

	// Rhino - Savanna grazer
	48: {
		liked: [
			"plains",
			"swamp"
		],
		disliked: ["cave", "mountain"]
	},

	// Giraffe - Tall savanna browser
	51: {
		liked: [
			"plains",
			"forest"
		],
		disliked: ["cave", "swamp"]
	},

	/*
	 * ===== DESERT ANIMALS =====
	 * Boar - Forest forager, root digger
	 */
	29: {
		liked: [
			"forest",
			"swamp",
			"plains"
		],
		disliked: ["desert"]
	},

	// Llama - Mountain and highland dweller
	32: {
		liked: [
			"mountain",
			"desert",
			"plains"
		],
		disliked: ["swamp"]
	},

	// Dromedary - Desert endurance specialist
	49: {
		liked: [
			"desert",
			"plains"
		],
		disliked: ["coast", "swamp"]
	},

	// Camel - Desert caravan animal
	50: {
		liked: [
			"desert",
			"plains"
		],
		disliked: ["coast", "swamp"]
	},

	/*
	 * ===== FOREST MAMMALS =====
	 * Skunk - Woodland creature with defense spray
	 */
	36: {
		liked: [
			"forest",
			"plains"
		],
		disliked: ["desert"]
	},

	// Badger - Burrowing forest dweller
	37: {
		liked: [
			"forest",
			"plains",
			"cave"
		],
		disliked: ["desert"]
	},

	// Beaver - Dam builder, needs water
	38: {
		liked: [
			"forest",
			"coast",
			"swamp"
		],
		disliked: ["desert", "mountain"]
	},

	// Sloth - Tropical canopy dweller, very slow
	39: {
		liked: [
			"forest",
			"swamp"
		],
		disliked: ["desert", "mountain"]
	},

	// Otter - Playful swimmer, rivers and coasts
	55: {
		liked: [
			"coast",
			"swamp",
			"forest"
		],
		disliked: ["desert"]
	},

	// Deer - Forest and meadow graceful runner
	87: {
		liked: [
			"forest",
			"plains"
		],
		disliked: ["desert", "swamp"]
	},

	// Water buffalo - Wetland grazer
	88: {
		liked: [
			"plains",
			"swamp",
			"forest"
		],
		disliked: ["desert"]
	},

	// Bison - Great plains grazer
	89: {
		liked: [
			"plains",
			"mountain"
		],
		disliked: ["swamp", "cave"]
	},

	/*
	 * ===== AQUATIC =====
	 * Octopus - Intelligent sea creature, reef and cave dweller
	 */
	71: {
		liked: [
			"coast",
			"cave"
		],
		disliked: ["desert", "mountain"]
	},

	// Fish - Ocean dweller
	73: {
		liked: [
			"coast",
			"swamp"
		],
		disliked: ["desert", "mountain"]
	},

	// Tropical fish - Coral reef beauty
	74: {
		liked: [
			"coast",
			"swamp"
		],
		disliked: ["desert", "mountain"]
	},

	// Pufferfish - Coastal defender
	75: {
		liked: [
			"coast",
			"swamp"
		],
		disliked: ["desert", "mountain"]
	},

	// Jellyfish - Ocean drifter
	76: {
		liked: [
			"coast",
			"swamp"
		],
		disliked: ["desert", "mountain"]
	},

	// Shark - Apex ocean predator
	77: {
		liked: ["coast"],
		disliked: ["desert", "mountain"]
	},

	// Whale - Ocean giant
	78: {
		liked: ["coast"],
		disliked: ["desert", "mountain"]
	},

	// Whale 2 - Another ocean giant
	79: {
		liked: ["coast"],
		disliked: ["desert", "mountain"]
	},

	// Shrimp - Bottom dweller, shallow waters
	80: {
		liked: [
			"coast",
			"swamp",
			"cave"
		],
		disliked: ["desert", "mountain"]
	},

	// Lobster - Ocean floor scavenger
	81: {
		liked: [
			"coast",
			"cave"
		],
		disliked: ["desert", "mountain"]
	},

	// Dolphin - Intelligent ocean mammal
	82: {
		liked: ["coast"],
		disliked: ["desert", "mountain"]
	},

	// Crab - Shore and cave dweller
	86: {
		liked: [
			"coast",
			"swamp",
			"cave"
		],
		disliked: ["desert"]
	},

	// Snail - Slow, damp loving
	85: {
		liked: [
			"forest",
			"swamp",
			"ruins"
		],
		disliked: ["desert"]
	},

	/*
	 * ===== MYTHICAL CREATURES =====
	 * Mammoth - Ancient ice age beast
	 */
	61: {
		liked: [
			"mountain",
			"plains"
		],
		disliked: ["desert", "swamp"]
	},

	// Unicorn - Magical forest creature
	63: {
		liked: [
			"forest",
			"plains"
		],
		disliked: ["cave", "swamp"]
	},

	// Dragon - Mountain and cave dwelling legend
	64: {
		liked: [
			"mountain",
			"cave",
			"ruins"
		],
		disliked: ["swamp"]
	},

	// T-Rex - Ancient apex predator
	65: {
		liked: [
			"plains",
			"forest",
			"swamp"
		],
		disliked: ["coast", "cave"]
	},

	// Phoenix - Fire bird, high places
	83: {
		liked: [
			"mountain",
			"desert",
			"ruins"
		],
		disliked: ["coast", "swamp"]
	},

	// Diplodocus - Gentle giant herbivore
	84: {
		liked: [
			"plains",
			"forest",
			"swamp"
		],
		disliked: ["cave", "mountain"]
	},

	/*
	 * ===== SPECIAL/SEASONAL =====
	 * Stitch - Chaotic alien experiment
	 */
	66: {
		liked: [
			"ruins",
			"coast",
			"cave"
		],
		disliked: []
	},

	// Snowman - Cold loving, melts in heat
	67: {
		liked: ["mountain"],
		disliked: ["desert", "swamp"]
	},

	// Scarlet duck - Magical water bird
	68: {
		liked: [
			"coast",
			"swamp",
			"plains"
		],
		disliked: ["desert"]
	},

	// Snow person - Cold creature
	69: {
		liked: ["mountain"],
		disliked: ["desert", "swamp"]
	},

	// Alien - Cosmic explorer, curious about everything
	70: {
		liked: [
			"ruins",
			"desert",
			"cave"
		],
		disliked: []
	},

	// Jack-o-lantern - Halloween spirit, haunted places
	99: {
		liked: [
			"ruins",
			"cave",
			"swamp"
		],
		disliked: ["coast", "desert"]
	},

	// Ghost - Ethereal spirit, haunts old places
	100: {
		liked: [
			"ruins",
			"cave"
		],
		disliked: ["plains"]
	},

	// Vampire - Nocturnal undead, avoids sunlight
	101: {
		liked: [
			"cave",
			"ruins",
			"forest"
		],
		disliked: ["plains", "desert"]
	}
};

/**
 * Get pet expedition preference for a given location type
 */
export function getPetExpeditionPreference(petTypeId: number, locationType: ExpeditionLocationType): PetExpeditionPreference {
	const preferences = PET_EXPEDITION_PREFERENCES[petTypeId];

	if (!preferences) {
		return "neutral";
	}

	if (preferences.liked.includes(locationType)) {
		return "liked";
	}

	if (preferences.disliked.includes(locationType)) {
		return "disliked";
	}

	return "neutral";
}

/**
 * Get the raw expedition preferences for a pet (liked and disliked location types)
 * Returns undefined if the pet has no specific preferences
 */
export function getPetExpeditionPreferences(petTypeId: number): {
	liked: readonly ExpeditionLocationType[]; disliked: readonly ExpeditionLocationType[];
} | undefined {
	return PET_EXPEDITION_PREFERENCES[petTypeId];
}
