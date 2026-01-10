import {
	DataTypes, QueryInterface
} from "sequelize";

export const itemAttributes001 = {
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true
	},
	rarity: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	rawAttack: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	rawDefense: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	rawSpeed: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	attack: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	defense: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	speed: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	fr: {
		type: DataTypes.TEXT,
		allowNull: false
	},
	en: {
		type: DataTypes.TEXT,
		allowNull: false
	},
	frenchMasculine: {
		type: DataTypes.BOOLEAN,
		allowNull: false
	},
	frenchPlural: {
		type: DataTypes.BOOLEAN,
		allowNull: false
	},
	emote: {
		type: DataTypes.STRING,
		allowNull: false
	},
	fallbackEmote: {
		type: DataTypes.STRING,
		allowNull: true
	},
	updatedAt: DataTypes.DATE,
	createdAt: DataTypes.DATE
};

const supportItemAttributes = {
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true
	},
	rarity: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	power: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	nature: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	fr: {
		type: DataTypes.TEXT,
		allowNull: false
	},
	en: {
		type: DataTypes.TEXT,
		allowNull: false
	},
	frenchMasculine: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	frenchPlural: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	emote: {
		type: DataTypes.STRING,
		allowNull: false
	},
	fallbackEmote: {
		type: DataTypes.STRING,
		allowNull: true
	},
	updatedAt: DataTypes.DATE,
	createdAt: DataTypes.DATE
};

export const guildsAttributes001 = {
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		autoIncrement: true
	},
	name: {
		type: DataTypes.STRING(32), // eslint-disable-line new-cap
		allowNull: false
	},
	guildDescription: DataTypes.STRING(300), // eslint-disable-line new-cap
	score: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	level: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	experience: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	commonFood: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	carnivorousFood: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	herbivorousFood: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	ultimateFood: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	lastDailyAt: DataTypes.DATE,
	chiefId: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	elderId: DataTypes.INTEGER,
	updatedAt: DataTypes.DATE,
	createdAt: DataTypes.DATE
};

export const petEntitiesAttributes001 = {
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		autoIncrement: true
	},
	petId: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	sex: DataTypes.CHAR,
	nickname: DataTypes.TEXT,
	lovePoints: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	hungrySince: DataTypes.DATE,
	updatedAt: DataTypes.DATE,
	createdAt: DataTypes.DATE
};

export const petAttributes001 = {
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true
	},
	rarity: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	maleNameFr: {
		type: DataTypes.TEXT,
		allowNull: false
	},
	maleNameEn: {
		type: DataTypes.TEXT,
		allowNull: false
	},
	femaleNameFr: {
		type: DataTypes.TEXT,
		allowNull: false
	},
	femaleNameEn: {
		type: DataTypes.TEXT,
		allowNull: false
	},
	emoteMale: {
		type: DataTypes.TEXT,
		allowNull: false
	},
	emoteFemale: {
		type: DataTypes.TEXT,
		allowNull: false
	},
	diet: { type: DataTypes.TEXT },
	updatedAt: DataTypes.DATE,
	createdAt: DataTypes.DATE
};

export const entitiesAttributes001 = {
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		autoIncrement: true
	},
	maxHealth: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	health: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	attack: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	defense: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	speed: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	fightPointsLost: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	discordUserId: {
		type: DataTypes.STRING(64), // eslint-disable-line new-cap
		allowNull: false
	},
	updatedAt: DataTypes.DATE,
	createdAt: DataTypes.DATE
};

export const playersAttributes001 = {
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		autoIncrement: true
	},
	score: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	weeklyScore: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	level: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	experience: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	money: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	class: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	badges: DataTypes.TEXT,
	entityId: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	guildId: DataTypes.INTEGER,
	topggVoteAt: DataTypes.DATE,
	nextEvent: DataTypes.INTEGER,
	petId: DataTypes.INTEGER,
	lastPetFree: DataTypes.DATE,
	effect: {
		type: DataTypes.STRING(32), // eslint-disable-line new-cap
		allowNull: false
	},
	effectEndDate: DataTypes.DATE,
	effectDuration: DataTypes.INTEGER,
	mapLinkId: DataTypes.INTEGER,
	startTravelDate: DataTypes.DATE,
	dmNotification: {
		type: DataTypes.BOOLEAN,
		allowNull: false
	},
	updatedAt: DataTypes.DATE,
	createdAt: DataTypes.DATE
};

export const bigEventsAttributes001 = {
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true
	},
	fr: {
		type: DataTypes.TEXT,
		allowNull: false
	},
	en: {
		type: DataTypes.TEXT,
		allowNull: false
	},
	restrictedMaps: {
		type: DataTypes.INTEGER
	},
	updatedAt: DataTypes.DATE,
	createdAt: DataTypes.DATE
};

export const eventMapLocationIdsAttributes001 = {
	eventId: {
		type: DataTypes.INTEGER,
		primaryKey: true
	},
	mapLocationId: {
		type: DataTypes.INTEGER,
		primaryKey: true
	},
	updatedAt: DataTypes.DATE,
	createdAt: DataTypes.DATE
};

export const possibilitiesAttributes001 = {
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		autoIncrement: true
	},
	possibilityKey: {
		type: DataTypes.STRING(32), // eslint-disable-line new-cap
		allowNull: false
	},
	lostTime: {
		type: DataTypes.BIGINT,
		allowNull: false
	},
	health: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	oneshot: {
		type: DataTypes.BOOLEAN,
		allowNull: false
	},
	effect: {
		type: DataTypes.STRING(32), // eslint-disable-line new-cap
		allowNull: false
	},
	experience: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	money: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	item: {
		type: DataTypes.BOOLEAN,
		allowNull: false
	},
	fr: {
		type: DataTypes.TEXT,
		allowNull: false
	},
	en: {
		type: DataTypes.TEXT,
		allowNull: false
	},
	eventId: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	nextEvent: { type: DataTypes.INTEGER },
	restrictedMaps: {
		type: DataTypes.TEXT
	},
	updatedAt: DataTypes.DATE,
	createdAt: DataTypes.DATE
};

export const shopAttributes001 = {
	shopPotionId: DataTypes.INTEGER,
	updatedAt: DataTypes.DATE,
	createdAt: DataTypes.DATE
};

export const classesAttributes001 = {
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true
	},
	attack: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	defense: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	speed: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	health: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	fightPoint: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	emoji: {
		type: DataTypes.TEXT,
		allowNull: false
	},
	classGroup: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	price: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	fr: {
		type: DataTypes.TEXT,
		allowNull: false
	},
	en: {
		type: DataTypes.TEXT,
		allowNull: false
	},
	updatedAt: DataTypes.DATE,
	createdAt: DataTypes.DATE
};

export const missionsAttributes001 = {
	id: {
		type: DataTypes.STRING(64), // eslint-disable-line new-cap
		primaryKey: true
	},
	descFr: {
		type: DataTypes.TEXT,
		allowNull: false
	},
	descEn: {
		type: DataTypes.TEXT,
		allowNull: false
	},
	campaignOnly: {
		type: DataTypes.BOOLEAN,
		allowNull: false
	},
	canBeDaily: {
		type: DataTypes.BOOLEAN,
		allowNull: false
	},
	canBeEasy: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	canBeMedium: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	canBeHard: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	updatedAt: DataTypes.DATE,
	createdAt: DataTypes.DATE
};

export const serversAttributes001 = {
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		autoIncrement: true
	},
	language: {
		type: DataTypes.STRING(2), // eslint-disable-line new-cap
		allowNull: false
	},
	discordGuildId: {
		type: DataTypes.STRING(64), // eslint-disable-line new-cap
		allowNull: false
	},
	updatedAt: DataTypes.DATE,
	createdAt: DataTypes.DATE
};

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await context.createTable("armors", itemAttributes001);
	await context.createTable("classes", classesAttributes001);
	await context.createTable("daily_mission", {
		id: {
			type: DataTypes.INTEGER,
			primaryKey: true
		},
		missionId: DataTypes.TEXT,
		objective: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		variant: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		gemsToWin: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		xpToWin: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		moneyToWin: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		lastDate: DataTypes.DATE,
		updatedAt: DataTypes.DATE,
		createdAt: DataTypes.DATE
	});
	await context.createTable("entities", entitiesAttributes001);
	await context.createTable("event_map_location_ids", eventMapLocationIdsAttributes001);
	await context.createTable("events", bigEventsAttributes001);
	await context.createTable("guild_pets", {
		id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true
		},
		guildId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		petEntityId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		updatedAt: DataTypes.DATE,
		createdAt: DataTypes.DATE
	});
	await context.createTable("guilds", guildsAttributes001);
	await context.createTable("inventory_info", {
		playerId: {
			type: DataTypes.INTEGER,
			primaryKey: true
		},
		lastDailyAt: DataTypes.DATE,
		weaponSlots: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		armorSlots: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		potionSlots: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		objectSlots: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		updatedAt: DataTypes.DATE,
		createdAt: DataTypes.DATE
	});
	await context.createTable("inventory_slots", {
		playerId: {
			type: DataTypes.INTEGER,
			primaryKey: true
		},
		slot: {
			type: DataTypes.INTEGER,
			primaryKey: true
		},
		itemCategory: {
			type: DataTypes.INTEGER,
			primaryKey: true
		},
		itemId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		updatedAt: DataTypes.DATE,
		createdAt: DataTypes.DATE
	});
	await context.createTable("map_links", {
		id: {
			type: DataTypes.INTEGER,
			primaryKey: true
		},
		startMap: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		endMap: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		tripDuration: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		updatedAt: DataTypes.DATE,
		createdAt: DataTypes.DATE
	});
	await context.createTable("map_locations", {
		id: {
			type: DataTypes.INTEGER,
			primaryKey: true
		},
		type: {
			type: DataTypes.TEXT,
			allowNull: false
		},
		nameFr: {
			type: DataTypes.TEXT,
			allowNull: false
		},
		nameEn: {
			type: DataTypes.TEXT,
			allowNull: false
		},
		descFr: {
			type: DataTypes.TEXT,
			allowNull: false
		},
		descEn: {
			type: DataTypes.TEXT,
			allowNull: false
		},
		particleFr: {
			type: DataTypes.TEXT,
			allowNull: false
		},
		particleEn: {
			type: DataTypes.TEXT,
			allowNull: false
		},
		canBeGoToPlaceMissionDestination: {
			type: DataTypes.BOOLEAN,
			allowNull: false
		},
		updatedAt: DataTypes.DATE,
		createdAt: DataTypes.DATE
	});
	await context.createTable("mission_slots", {
		id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true
		},
		playerId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		missionId: {
			type: DataTypes.TEXT,
			allowNull: false
		},
		missionVariant: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		missionObjective: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		expiresAt: DataTypes.DATE,
		numberDone: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		gemsToWin: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		xpToWin: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		moneyToWin: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		saveBlob: DataTypes.BLOB,
		updatedAt: DataTypes.DATE,
		createdAt: DataTypes.DATE
	});
	await context.createTable("missions", missionsAttributes001);
	await context.createTable("objects", supportItemAttributes);
	await context.createTable("pet_entities", petEntitiesAttributes001);
	await context.createTable("pets", petAttributes001);
	await context.createTable("player_missions_info", {
		playerId: {
			type: DataTypes.INTEGER,
			primaryKey: true
		},
		gems: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		hasBoughtPointsThisWeek: {
			type: DataTypes.BOOLEAN,
			allowNull: false
		},
		dailyMissionNumberDone: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		lastDailyMissionCompleted: {
			type: DataTypes.DATE
		},
		campaignProgression: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		updatedAt: DataTypes.DATE,
		createdAt: DataTypes.DATE
	});
	await context.createTable("player_small_events", {
		id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true
		},
		playerId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		eventType: {
			type: DataTypes.TEXT,
			allowNull: false
		},
		time: {
			type: DataTypes.BIGINT,
			allowNull: false
		},
		updatedAt: DataTypes.DATE,
		createdAt: DataTypes.DATE
	});
	await context.createTable("players", playersAttributes001);
	await context.createTable("possibilities", possibilitiesAttributes001);
	await context.createTable("potions", supportItemAttributes);
	await context.createTable("servers", serversAttributes001);
	await context.createTable("shop", shopAttributes001);
	await context.createTable("tags", {
		id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true
		},
		textTag: {
			type: DataTypes.STRING,
			allowNull: false
		},
		idObject: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		typeObject: {
			type: DataTypes.STRING,
			allowNull: false
		},
		updatedAt: DataTypes.DATE,
		createdAt: DataTypes.DATE
	});
	await context.createTable("weapons", itemAttributes001);
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.dropTable("armors");
	await context.dropTable("classes");
	await context.dropTable("daily_mission");
	await context.dropTable("entities");
	await context.dropTable("event_map_location_ids");
	await context.dropTable("events");
	await context.dropTable("guild_pets");
	await context.dropTable("guilds");
	await context.dropTable("inventory_info");
	await context.dropTable("inventory_slots");
	await context.dropTable("map_links");
	await context.dropTable("map_locations");
	await context.dropTable("mission_slots");
	await context.dropTable("missions");
	await context.dropTable("objects");
	await context.dropTable("pet_entities");
	await context.dropTable("pets");
	await context.dropTable("player_missions_info");
	await context.dropTable("player_small_events");
	await context.dropTable("players");
	await context.dropTable("possibilities");
	await context.dropTable("potions");
	await context.dropTable("servers");
	await context.dropTable("shop");
	await context.dropTable("tags");
	await context.dropTable("weapons");
}
