export abstract class ItemConstants {
	static readonly SLOTS = {
		LIMITS: [
			2,
			2,
			4,
			4
		],
		PRICES: [
			500,
			1000,
			2500,
			7000,
			12000,
			17000,
			25000,
			30000
		]
	};

	static readonly NATURE = {
		NONE: 0,
		HEALTH: 1,
		SPEED: 2,
		ATTACK: 3,
		DEFENSE: 4,
		HOSPITAL: 5,
		MONEY: 6,
		ENERGY: 7
	};

	static readonly RARITY = {
		BASIC: 0,
		COMMON: 1,
		UNCOMMON: 2,
		EXOTIC: 3,
		RARE: 4,
		SPECIAL: 5,
		EPIC: 6,
		LEGENDARY: 7,
		MYTHICAL: 8,

		VALUES: [
			0, // Basic
			20, // Common
			40, // Uncommon
			100, // Exotic
			250, // Rare
			580, // Special
			1690, // Epic
			5000, // Legendary
			10000 // Mythic
		],

		GENERATOR: {
			VALUES: [ // Common
				4375, // Uncommon
				6875, // Exotic
				8375, // Rare
				9375, // Special
				9875, // Epic
				9975, // Legendary
				9998, // Mythic
				10000
			],
			MAX_VALUE: 10000 // Be sure this number is the same as the last value in the VALUES array
		}
	};

	static readonly TAGS = {
		HOLY: "holy"
	};

	static readonly CATEGORIES = {
		WEAPON: 0,
		ARMOR: 1,
		POTION: 2,
		OBJECT: 3
	};
}