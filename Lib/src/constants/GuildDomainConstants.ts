export enum GuildBuilding {
	SHOP = "shop",
	SHELTER = "shelter",
	PANTRY = "pantry",
	TRAINING_GROUND = "trainingGround"
}

type BuildingLevelRequirement = {
	guildLevel: number;
	cost: number;
};

export abstract class GuildDomainConstants {
	static readonly BUILDINGS: Record<GuildBuilding, {
		maxLevel: number;
		levels: readonly BuildingLevelRequirement[];
	}> = {
		[GuildBuilding.SHOP]: {
			maxLevel: 1,
			levels: [
				{
					guildLevel: 5,
					cost: 5_000
				}
			]
		},
		[GuildBuilding.SHELTER]: {
			maxLevel: 6,
			levels: [
				{
					guildLevel: 15,
					cost: 25_000
				},
				{
					guildLevel: 40,
					cost: 50_000
				},
				{
					guildLevel: 75,
					cost: 100_000
				},
				{
					guildLevel: 100,
					cost: 200_000
				},
				{
					guildLevel: 120,
					cost: 300_000
				},
				{
					guildLevel: 150,
					cost: 400_000
				}
			]
		},
		[GuildBuilding.PANTRY]: {
			maxLevel: 4,
			levels: [
				{
					guildLevel: 15,
					cost: 100_000
				},
				{
					guildLevel: 40,
					cost: 150_000
				},
				{
					guildLevel: 75,
					cost: 250_000
				},
				{
					guildLevel: 100,
					cost: 300_000
				}
			]
		},
		[GuildBuilding.TRAINING_GROUND]: {
			maxLevel: 3,
			levels: [
				{
					guildLevel: 50,
					cost: 400_000
				},
				{
					guildLevel: 100,
					cost: 800_000
				},
				{
					guildLevel: 150,
					cost: 1_600_000
				}
			]
		}
	};

	/**
	 * Pet shelter capacity per shelter building level (index = level)
	 */
	static readonly SHELTER_SLOTS = [
		6,
		8,
		10,
		12,
		14,
		16,
		18
	] as const;

	/**
	 * Food caps per pantry level: [common, carnivorous, herbivorous, ultimate]
	 */
	static readonly PANTRY_FOOD_CAPS = [
		[
			150,
			90,
			90,
			30
		],
		[
			250,
			150,
			150,
			50
		],
		[
			400,
			240,
			240,
			80
		],
		[
			700,
			420,
			420,
			140
		],
		[
			1000,
			600,
			600,
			200
		]
	] as const;

	/**
	 * Love points gained per day per training ground level (index = level)
	 */
	static readonly TRAINING_LOVE_PER_DAY = [
		0,
		1,
		2,
		3
	] as const;

	/**
	 * Daily auto-fill food generation per pantry level: [common, carnivorous, herbivorous, ultimate]
	 * Level 0 has no auto-fill (no pantry building)
	 */
	static readonly PANTRY_AUTO_FILL = [
		[
			0,
			0,
			0,
			0
		],
		[
			3,
			0,
			0,
			0
		],
		[
			3,
			0,
			0,
			0
		],
		[
			5,
			1,
			1,
			0
		],
		[
			6,
			2,
			2,
			1
		]
	] as const;

	/**
	 * Shop prices for food and guild XP
	 */
	static readonly SHOP_PRICES = {
		SMALL_XP: 1000,
		BIG_XP: 15000,
		FOOD: [
			20,
			250,
			250,
			600
		]
	};

	/**
	 * Cost to purchase the guild domain (from treasury)
	 */
	static readonly DOMAIN_PURCHASE_COST = 0;

	/**
	 * Cost to relocate the guild domain to another city (from treasury)
	 */
	static readonly DOMAIN_RELOCATION_COST = 100_000;

	/**
	 * Guild mission reward: love points added to player's active pet
	 */
	static readonly GUILD_MISSION_PET_LOVE_REWARD = 3;

	/**
	 * Guild weekly mission configuration
	 */
	static readonly GUILD_MISSIONS = {
		/**
		 * Mission IDs that can be selected as guild weekly missions.
		 * These should be simple count-based missions using the default interface.
		 */
		AVAILABLE: [
			"doReports",
			"earnPoints",
			"earnMoney",
			"earnXP",
			"petCaress",
			"doExpeditions"
		],

		/**
		 * Guild mission objectives per difficulty (indexed). Applied to the selected mission.
		 */
		OBJECTIVES: [
			50,
			100,
			200
		] as const,

		/**
		 * Rewards for completing the guild weekly mission
		 */
		REWARDS: {
			GUILD_XP: 500,
			GUILD_SCORE: 200,
			TREASURY_GOLD: 10_000,
			PERSONAL_XP: 150
		},

		/**
		 * Duration of a guild weekly mission in hours
		 */
		DURATION_HOURS: 168
	} as const;

	static getShelterSlots(shelterLevel: number): number {
		return GuildDomainConstants.SHELTER_SLOTS[shelterLevel] ?? GuildDomainConstants.SHELTER_SLOTS[0];
	}

	static getFoodCaps(pantryLevel: number): readonly number[] {
		return GuildDomainConstants.PANTRY_FOOD_CAPS[pantryLevel] ?? GuildDomainConstants.PANTRY_FOOD_CAPS[0];
	}

	static getTrainingLovePerDay(trainingGroundLevel: number): number {
		return GuildDomainConstants.TRAINING_LOVE_PER_DAY[trainingGroundLevel] ?? 0;
	}

	static getAutoFillRates(pantryLevel: number): readonly number[] {
		return GuildDomainConstants.PANTRY_AUTO_FILL[pantryLevel] ?? GuildDomainConstants.PANTRY_AUTO_FILL[0];
	}

	static getBuildingUpgradeCost(building: GuildBuilding, currentLevel: number): number | null {
		const config = GuildDomainConstants.BUILDINGS[building];
		if (currentLevel >= config.maxLevel) {
			return null;
		}
		return config.levels[currentLevel].cost;
	}

	static getBuildingRequiredGuildLevel(building: GuildBuilding, currentLevel: number): number | null {
		const config = GuildDomainConstants.BUILDINGS[building];
		if (currentLevel >= config.maxLevel) {
			return null;
		}
		return config.levels[currentLevel].guildLevel;
	}
}
