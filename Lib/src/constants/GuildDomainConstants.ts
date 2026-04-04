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
					cost: 30_000
				},
				{
					guildLevel: 25,
					cost: 60_000
				},
				{
					guildLevel: 40,
					cost: 120_000
				},
				{
					guildLevel: 60,
					cost: 200_000
				},
				{
					guildLevel: 80,
					cost: 300_000
				},
				{
					guildLevel: 100,
					cost: 370_000
				}
			]
		},
		[GuildBuilding.PANTRY]: {
			maxLevel: 3,
			levels: [
				{
					guildLevel: 15,
					cost: 80_000
				},
				{
					guildLevel: 40,
					cost: 240_000
				},
				{
					guildLevel: 75,
					cost: 480_000
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
					cost: 1_200_000
				},
				{
					guildLevel: 140,
					cost: 2_400_000
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
			25,
			15,
			15,
			5
		],
		[
			35,
			20,
			20,
			8
		],
		[
			50,
			30,
			30,
			12
		],
		[
			70,
			40,
			40,
			15
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
	 * Auto-feed feature unlocked at this pantry level
	 */
	static readonly AUTO_FEED_PANTRY_LEVEL = 3;

	/**
	 * Cost to purchase the guild domain (from treasury)
	 */
	static readonly DOMAIN_PURCHASE_COST = 5_000;

	/**
	 * Cost to relocate the guild domain to another city (from treasury)
	 */
	static readonly DOMAIN_RELOCATION_COST = 100_000;

	/**
	 * Minimum amount a player can contribute to the guild treasury
	 */
	static readonly MIN_CONTRIBUTE_AMOUNT = 100;

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
