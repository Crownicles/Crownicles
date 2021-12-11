export abstract class Constants {
	static readonly REACTIONS = {
		VALIDATE_REACTION: "✅",
		REFUSE_REACTION: "❌",
		SHOPPING_CART: "🛒",
		WARNING: "⚠️",
		NUMBERS: [
			"0️⃣",
			"1️⃣",
			"2️⃣",
			"3️⃣",
			"4️⃣",
			"5️⃣",
			"6️⃣",
			"7️⃣",
			"8️⃣",
			"9️⃣",
			"🔟"
		],
		INVENTORY_RESERVE: "🔃",
		MONEY_ICON: "💰",
		TRASH: "🗑️",
		INVENTORY_EXTENSION: "📦",
		ITEM_CATEGORIES: [
			"⚔️",
			"🛡️",
			"⚗️",
			"🧸"
		]
	};

	static readonly MESSAGES = {
		COLLECTOR_TIME: 120000,
		COLORS: {
			DEFAULT: "NOT_QUITE_BLACK"
		}
	};

	static readonly TOPGG = {
		BADGE: "🗳️",
		BADGE_DURATION: 12,
		ROLE_DURATION: 24,
		DBL_SERVER_COUNT_UPDATE_TIME: 1800000
	};

	static readonly ITEM_CATEGORIES = {
		WEAPON: 0,
		ARMOR: 1,
		POTION: 2,
		OBJECT: 3
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
		MYTHICAL: 8
	};

	static readonly ITEM_NATURE = {
		NO_EFFECT: 0,
		HEALTH: 1,
		SPEED: 2,
		ATTACK: 3,
		DEFENSE: 4,
		TIME_SPEEDUP: 5,
		MONEY: 6
	};

	static readonly BACKUP = {
		DATABASE_BACKUP_INTERVAL: 12 * 60 * 60 * 1000,
		LOCAL_SPACE_LIMIT: 500 * 1024 * 1024
	}

	static readonly FIGHT = {
		MAX_SPEED_IMPROVEMENT: 30,
		MAX_TURNS: 25,
		REQUIRED_LEVEL: 8,
		POINTS_REGEN_MINUTES: 15,
		POINTS_REGEN_AMOUNT: 50,
		ACTION: {
			QUICK_ATTACK: 0,
			SIMPLE_ATTACK: 1,
			POWERFUL_ATTACK: 2,
			BULK_ATTACK: 3,
			IMPROVE_SPEED: 4,
			ULTIMATE_ATTACK: 5
		}
	};

	static readonly NATURE = {
		NONE: 0,
		HEALTH: 1,
		SPEED: 2,
		ATTACK: 3,
		DEFENSE: 4,
		HOSPITAL: 5,
		MONEY: 6
	}

	static readonly PETS = {
		IS_FOOD: 1,
		MALE: "m",
		FEMALE: "f",
		FREE_COOLDOWN: 60 * 60 * 1000, // 1 hour
		BREED_COOLDOWN: 60 * 60 * 1000, // 1 hour
		MAX_LOVE_POINTS: 100,
		BASE_LOVE: 10,
		GUILD_LEVEL_USED_FOR_NO_GUILD_LOOT: 20,
		LOVE_LEVELS: [5, 20, 50],
		SELL: {
			MIN: 100,
			MAX: 50000
		}
	}

	static readonly LOGS = {
		LOG_COUNT_LINE_LIMIT: 50000
	}

	static readonly EFFECT = {
		EMOJIS: {
			":baby:": "👶",
			":smiley:": "😃",
			":clock10:": "🕙", // may be deleted : is used to avoir interaction when the bot is awaiting an answer
			":skull:": "💀",
			":sleeping:": "😴",
			":zany_face:": "🤪",
			":cold_face:": "🥶",
			":head_bandage:": "🤕",
			":sick:": "🤢",
			":lock:": "🔒",
			":dizzy_face:": "😵",
			":clock2:": "🕑",
			":drooling_face:": "🤤",
			":confounded:": "😖",
			":scream:": "😱"
		},
		BABY: ":baby:",
		SMILEY: ":smiley:",
		AWAITING_ANSWER: ":clock10:", // may be deleted : is used to avoir interaction when the bot is awaiting an answer
		DEAD: ":skull:",
		SLEEPING: ":sleeping:",
		DRUNK: ":zany_face:",
		FROZEN: ":cold_face:",
		HURT: ":head_bandage:",
		SICK: ":sick:",
		LOCKED: ":lock:",
		INJURED: ":dizzy_face:",
		OCCUPIED: ":clock2:",
		STARVING: ":drooling_face:",
		CONFOUNDED: ":confounded:",
		SCARED: ":scream:"
	};
}