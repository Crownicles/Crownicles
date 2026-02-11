import { TimeConstants } from "./TimeConstants";

export abstract class ClassConstants {
	static readonly CLASSES_ID = {
		RECRUIT: 0,
		FIGHTER: 1,
		SOLDIER: 2,
		INFANTRYMAN: 3,
		GLOVED: 4,
		HELMETED: 5,
		ENMESHED: 6,
		TANK: 7,
		ROCK_THROWER: 8,
		SLINGER: 9,
		ARCHER: 10,
		GUNNER: 11,
		ESQUIRE: 12,
		HORSE_RIDER: 13,
		PIKEMAN: 14,
		KNIGHT: 15,
		PALADIN: 16,
		VETERAN: 17,
		POWERFUL_INFANTRYMAN: 18,
		IMPENETRABLE_TANK: 19,
		FORMIDABLE_GUNNER: 20,
		VALIANT_KNIGHT: 21,
		LUMINOUS_PALADIN: 22,
		EXPERIENCED_VETERAN: 23,
		MYSTIC_MAGE: 24
	};

	static readonly GROUP1LEVEL = 16;

	static readonly GROUP2LEVEL = 32;

	static readonly GROUP3LEVEL = 48;

	static readonly GROUP4LEVEL = 80;

	static readonly TIME_BEFORE_CHANGE_CLASS = [
		1 * TimeConstants.S_TIME.WEEK,
		1 * TimeConstants.S_TIME.WEEK,
		2 * TimeConstants.S_TIME.WEEK,
		3 * TimeConstants.S_TIME.WEEK,
		3 * TimeConstants.S_TIME.WEEK
	];

	static readonly CLASS_KIND = {
		ATTACK: "attack",
		DEFENSE: "defense",
		BASIC: "basic",
		OTHER: "other"
	};

	static readonly CLASS_SMALL_EVENT_INTERACTIONS_NAMES = {
		WIN_WEAPON: "winWeapon",
		WIN_ARMOR: "winArmor",
		WIN_POTION: "winPotion",
		WIN_OBJECT: "winObject",
		WIN_ITEM: "winItem",
		WIN_HEALTH: "winHealth",
		WIN_MONEY: "winMoney"
	};

	static readonly CLASS_SMALL_EVENT_INTERACTIONS: {
		ATTACK: string[]; DEFENSE: string[]; BASIC: string[]; OTHER: string[];
	} = {
		ATTACK: [
			ClassConstants.CLASS_SMALL_EVENT_INTERACTIONS_NAMES.WIN_WEAPON,
			ClassConstants.CLASS_SMALL_EVENT_INTERACTIONS_NAMES.WIN_POTION,
			ClassConstants.CLASS_SMALL_EVENT_INTERACTIONS_NAMES.WIN_OBJECT
		],
		DEFENSE: [
			ClassConstants.CLASS_SMALL_EVENT_INTERACTIONS_NAMES.WIN_ARMOR,
			ClassConstants.CLASS_SMALL_EVENT_INTERACTIONS_NAMES.WIN_POTION,
			ClassConstants.CLASS_SMALL_EVENT_INTERACTIONS_NAMES.WIN_OBJECT
		],
		BASIC: [
			ClassConstants.CLASS_SMALL_EVENT_INTERACTIONS_NAMES.WIN_ITEM,
			ClassConstants.CLASS_SMALL_EVENT_INTERACTIONS_NAMES.WIN_MONEY
		],
		OTHER: [
			ClassConstants.CLASS_SMALL_EVENT_INTERACTIONS_NAMES.WIN_ITEM,
			ClassConstants.CLASS_SMALL_EVENT_INTERACTIONS_NAMES.WIN_HEALTH
		]
	};

	static readonly REQUIRED_LEVEL = 4;
}
