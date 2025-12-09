export enum NumberChangeReason {

	// Default value. Used to detect missing parameters in functions
	NULL,

	/*
	 * Value to use if you don't want to log the information, SHOULDN'T APPEAR IN THE DATABASE
	 * You MUST also comment why you use this constant where you use it
	 */
	IGNORE,

	// Admin
	TEST,
	ADMIN,
	DEBUG,

	// Events
	BIG_EVENT,
	SMALL_EVENT,
	RECEIVE_COIN,

	// Pets
	PET_SELL,
	PET_FEED,
	PET_FREE,

	// Missions
	MISSION_FINISHED,
	MISSION_SHOP,

	// Guild
	GUILD_DAILY,
	GUILD_CREATE,

	// Items
	ITEM_SELL,
	DAILY,
	DRINK,

	// Misc
	SHOP,
	CLASS,
	UNLOCK,
	LEVEL_UP,
	RESPAWN,
	NEW_PLAYER,
	FIGHT,
	LEAGUE_REWARD,
	PVE_ISLAND,
	PVE_FIGHT,
	FIGHT_PET_SMALL_EVENT,
	RAGE_EXPLOSION_ACTION,
	JOIN_BOAT,
	REPORT_TOKENS,
	EXPEDITION
}

export enum ShopItemType {
	DAILY_POTION,
	RANDOM_ITEM,
	ALTERATION_HEAL,
	FULL_REGEN,
	SLOT_EXTENSION,
	MONEY_MOUTH_BADGE,
	COMMON_FOOD,
	HERBIVOROUS_FOOD,
	CARNIVOROUS_FOOD,
	ULTIMATE_FOOD,
	MONEY,
	TREASURE,
	KINGS_FAVOR,
	SKIP_MISSION,
	LOVE_POINTS_VALUE,
	SMALL_GUILD_XP,
	ENERGY_HEAL,
	BIG_GUILD_XP,
	QUEST_MASTER_BADGE,
	TOKEN
}

export const ShopItemTypeToString: Record<ShopItemType, string> = {
	[ShopItemType.DAILY_POTION]: "dailyPotion",
	[ShopItemType.RANDOM_ITEM]: "randomItem",
	[ShopItemType.ALTERATION_HEAL]: "alterationHeal",
	[ShopItemType.FULL_REGEN]: "fullRegen",
	[ShopItemType.SLOT_EXTENSION]: "slotExtension",
	[ShopItemType.MONEY_MOUTH_BADGE]: "moneyMouthBadge",
	[ShopItemType.COMMON_FOOD]: "commonFood",
	[ShopItemType.HERBIVOROUS_FOOD]: "herbivorousFood",
	[ShopItemType.CARNIVOROUS_FOOD]: "carnivorousFood",
	[ShopItemType.ULTIMATE_FOOD]: "ultimateFood",
	[ShopItemType.MONEY]: "money",
	[ShopItemType.TREASURE]: "treasure",
	[ShopItemType.KINGS_FAVOR]: "kingsFavor",
	[ShopItemType.SKIP_MISSION]: "skipMission",
	[ShopItemType.LOVE_POINTS_VALUE]: "lovePointsValue",
	[ShopItemType.SMALL_GUILD_XP]: "smallGuildXp",
	[ShopItemType.ENERGY_HEAL]: "energyHeal",
	[ShopItemType.BIG_GUILD_XP]: "bigGuildXp",
	[ShopItemType.QUEST_MASTER_BADGE]: "questMasterBadge",
	[ShopItemType.TOKEN]: "token"
};
