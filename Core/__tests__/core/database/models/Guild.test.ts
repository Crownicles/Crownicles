import {
	afterEach, beforeEach, describe, expect, it, vi
} from "vitest";
import {
	Op, QueryTypes, Sequelize, Transaction
} from "sequelize";
import Guild, {
	Guilds, initModel as initGuild
} from "../../../../src/core/database/game/models/Guild";
import PetEntity, {
	initModel as initPetEntity, PetEntities
} from "../../../../src/core/database/game/models/PetEntity";
import Player, { Players } from "../../../../src/core/database/game/models/Player";
import {
	GuildPet, GuildPets
} from "../../../../src/core/database/game/models/GuildPet";
import { MissionsController } from "../../../../src/core/missions/MissionsController";
import { Crownicles } from "../../../../src/core/bot/Crownicles";
import { setCrowniclesInstanceForTests } from "../../../../src/app";
import { GuildConstants } from "../../../../../Lib/src/constants/GuildConstants";
import { GuildDomainConstants } from "../../../../../Lib/src/constants/GuildDomainConstants";
import { TopConstants } from "../../../../../Lib/src/constants/TopConstants";
import { NumberChangeReason } from "../../../../../Lib/src/constants/LogsConstants";
import { PetConstants } from "../../../../../Lib/src/constants/PetConstants";
import { CrowniclesPacket } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { GuildLevelUpPacket } from "../../../../../Lib/src/packets/events/GuildLevelUpPacket";
import { CrowniclesLogger } from "../../../../../Lib/src/logs/CrowniclesLogger";
import {
	CLS_TRANSACTION_KEY, runInChildContext
} from "../../../../../Lib/src/locks/CLSNamespace";

vi.mock("../../../../src/core/missions/MissionsController", () => ({
	MissionsController: { update: vi.fn().mockResolvedValue(undefined) }
}));

const sequelize = new Sequelize({
	dialect: "mariadb", logging: false
});
initGuild(sequelize);
initPetEntity(sequelize);

// Experience needed to go from a level to the next one
const XP_TO_LEVEL_1 = 150;
const XP_TO_LEVEL_2 = 164;
const XP_TO_MAX_LEVEL = 134551;

const logsDatabase = {
	logGuildExperienceChange: vi.fn().mockResolvedValue(undefined),
	logGuildLevelUp: vi.fn().mockResolvedValue(undefined),
	logGuildsFoodChanges: vi.fn().mockResolvedValue(undefined),
	logGuildPointsChange: vi.fn().mockResolvedValue(undefined),
	logGuildDestroy: vi.fn().mockResolvedValue(undefined)
};

/**
 * Build an unsaved guild with the default values of a new guild
 */
function buildGuild(values: Record<string, unknown> = {}): Guild {
	return Guild.build({
		id: 3,
		name: "Les Bricoleurs",
		chiefId: 10,
		elderId: 11,
		...values
	});
}

/**
 * Members of the guild returned by the database
 */
function members(...ids: number[]): Player[] {
	return ids.map(id => ({ id }) as Player);
}

describe("Guild", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		setCrowniclesInstanceForTests({ logsDatabase } as unknown as Crownicles); // Only the guild logs
	});

	afterEach(() => {
		setCrowniclesInstanceForTests(null);
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	describe("experience", () => {
		it.each([
			[0, XP_TO_LEVEL_1],
			[1, XP_TO_LEVEL_2],
			[GuildConstants.MAX_LEVEL - 1, XP_TO_MAX_LEVEL]
		])("should need the right experience to level up from level %s", (level, experience) => {
			expect(buildGuild({ level }).getExperienceNeededToLevelUp()).toBe(experience);
		});

		it("should add experience below the level threshold and log it", async () => {
			const guild = buildGuild({
				level: 0, experience: 10
			});
			const response: CrowniclesPacket[] = [];

			await guild.addExperience({
				amount: 20, response, reason: NumberChangeReason.SMALL_EVENT
			});

			expect(guild.experience).toBe(30);
			expect(guild.level).toBe(0);
			expect(response).toEqual([]);
			expect(logsDatabase.logGuildExperienceChange).toHaveBeenCalledWith(guild, NumberChangeReason.SMALL_EVENT);
			expect(logsDatabase.logGuildLevelUp).not.toHaveBeenCalled();
		});

		it("should never let the experience go negative", async () => {
			const guild = buildGuild({
				level: 0, experience: 10
			});

			await guild.addExperience({
				amount: -50, response: [], reason: NumberChangeReason.SMALL_EVENT
			});

			expect(guild.experience).toBe(0);
		});

		it("should level up when reaching exactly the threshold and set the level mission of every member", async () => {
			vi.spyOn(Players, "getByGuild").mockResolvedValue(members(10, 11));
			const guild = buildGuild({
				level: 0, experience: 0
			});
			const response: CrowniclesPacket[] = [];

			await guild.addExperience({
				amount: XP_TO_LEVEL_1, response, reason: NumberChangeReason.SMALL_EVENT
			});

			expect(guild.level).toBe(1);
			expect(guild.experience).toBe(0);
			expect(response).toHaveLength(1);
			expect(response[0]).toBeInstanceOf(GuildLevelUpPacket);
			expect({ ...response[0] }).toEqual({
				guildName: "Les Bricoleurs", level: 1
			});
			expect(logsDatabase.logGuildLevelUp).toHaveBeenCalledWith(guild);
			expect(logsDatabase.logGuildExperienceChange).toHaveBeenCalledWith(guild, NumberChangeReason.LEVEL_UP);
			expect(Players.getByGuild).toHaveBeenCalledWith(3);
			expect(vi.mocked(MissionsController.update).mock.calls).toEqual([
				[{ id: 10 }, response, {
					missionId: "guildLevel", count: 1, set: true
				}],
				[{ id: 11 }, response, {
					missionId: "guildLevel", count: 1, set: true
				}]
			]);
		});

		it("should chain several level ups and keep the remaining experience", async () => {
			vi.spyOn(Players, "getByGuild").mockResolvedValue([]);
			const guild = buildGuild({
				level: 0, experience: 0
			});
			const response: CrowniclesPacket[] = [];

			await guild.addExperience({
				amount: XP_TO_LEVEL_1 + XP_TO_LEVEL_2 + 7, response, reason: NumberChangeReason.SMALL_EVENT
			});

			expect(guild.level).toBe(2);
			expect(guild.experience).toBe(7);
			expect(response.map(packet => (packet as GuildLevelUpPacket).level)).toEqual([1, 2]);
		});

		it("should keep updating the other members when the mission of one fails", async () => {
			vi.spyOn(Players, "getByGuild").mockResolvedValue(members(10, 11));
			vi.mocked(MissionsController.update).mockRejectedValueOnce(new Error("locked"));
			const errorLog = vi.spyOn(CrowniclesLogger, "errorWithObj").mockImplementation(() => undefined);
			const guild = buildGuild({
				level: 0, experience: 0
			});

			await guild.addExperience({
				amount: XP_TO_LEVEL_1, response: [], reason: NumberChangeReason.SMALL_EVENT
			});

			expect(MissionsController.update).toHaveBeenCalledTimes(2);
			expect(vi.mocked(MissionsController.update).mock.calls[1][0]).toEqual({ id: 11 });
			expect(errorLog).toHaveBeenCalledOnce();
		});

		it("should stop exactly at the max level without keeping extra experience", async () => {
			vi.spyOn(Players, "getByGuild").mockResolvedValue([]);
			const guild = buildGuild({
				level: GuildConstants.MAX_LEVEL - 1, experience: 100
			});

			await guild.addExperience({
				amount: 10 * XP_TO_MAX_LEVEL, response: [], reason: NumberChangeReason.SMALL_EVENT
			});

			expect(guild.level).toBe(GuildConstants.MAX_LEVEL);
			expect(guild.experience).toBe(0);
			expect(guild.isAtMaxLevel()).toBe(true);
		});

		it("should add experience normally just before the max level when the threshold is not reached", async () => {
			const guild = buildGuild({
				level: GuildConstants.MAX_LEVEL - 1, experience: 100
			});

			await guild.addExperience({
				amount: 50, response: [], reason: NumberChangeReason.SMALL_EVENT
			});

			expect(guild.experience).toBe(150);
			expect(guild.level).toBe(GuildConstants.MAX_LEVEL - 1);
		});

		it("should ignore experience at the max level", async () => {
			const guild = buildGuild({
				level: GuildConstants.MAX_LEVEL, experience: 0
			});

			await guild.addExperience({
				amount: 500, response: [], reason: NumberChangeReason.SMALL_EVENT
			});

			expect(guild.experience).toBe(0);
			expect(logsDatabase.logGuildExperienceChange).not.toHaveBeenCalled();
		});

		it.each([
			[GuildConstants.MAX_LEVEL - 1, false],
			[GuildConstants.MAX_LEVEL, true]
		])("should consider the level %s max: %s", (level, max) => {
			expect(buildGuild({ level }).isAtMaxLevel()).toBe(max);
		});
	});

	describe("pet shelter", () => {
		/**
		 * Guild pets fixtures
		 */
		function guildPets(count: number): GuildPet[] {
			return new Array(count).fill({}) as GuildPet[];
		}

		it("should consider the shelter full when the guild pets cannot be read", () => {
			expect(buildGuild().isPetShelterFull(null as unknown as GuildPet[])).toBe(true); // Defensive branch on a missing list
		});

		it.each([0, 3])("should make the shelter hold the slots of its level %s", shelterLevel => {
			const guild = buildGuild({ shelterLevel });
			const slots = GuildDomainConstants.SHELTER_SLOTS[shelterLevel];

			expect(guild.getShelterCapacity()).toBe(slots);
			expect(guild.isPetShelterFull(guildPets(slots - 1))).toBe(false);
			expect(guild.isPetShelterFull(guildPets(slots))).toBe(true);
		});
	});

	describe("pantry", () => {
		const caps = GuildDomainConstants.PANTRY_FOOD_CAPS[1];

		it.each([
			[PetConstants.PET_FOOD.COMMON_FOOD, 0],
			[PetConstants.PET_FOOD.HERBIVOROUS_FOOD, 1],
			[PetConstants.PET_FOOD.CARNIVOROUS_FOOD, 2],
			[PetConstants.PET_FOOD.ULTIMATE_FOOD, 3]
		])("should give %s the capacity of its pantry level", (food, index) => {
			expect(buildGuild({ pantryLevel: 1 }).getFoodCapacityFor(food)).toBe(caps[index]);
		});

		it("should consider the storage full only when going over the capacity", () => {
			const guild = buildGuild({
				pantryLevel: 1, herbivorousFood: caps[1] - 3
			});

			expect(guild.isStorageFullFor(PetConstants.PET_FOOD.HERBIVOROUS_FOOD, 3)).toBe(false);
			expect(guild.isStorageFullFor(PetConstants.PET_FOOD.HERBIVOROUS_FOOD, 4)).toBe(true);
		});

		it("should add food and log the new amount", () => {
			const guild = buildGuild({
				pantryLevel: 1, carnivorousFood: 5
			});

			guild.addFood(PetConstants.PET_FOOD.CARNIVOROUS_FOOD, 4, NumberChangeReason.GUILD_DAILY);

			expect(guild.getFoodAmount(PetConstants.PET_FOOD.CARNIVOROUS_FOOD)).toBe(9);
			expect(logsDatabase.logGuildsFoodChanges).toHaveBeenCalledWith(guild, 2, 9, NumberChangeReason.GUILD_DAILY);
		});

		it("should cap the added food to the pantry capacity", () => {
			const guild = buildGuild({
				pantryLevel: 1, ultimateFood: caps[3] - 1
			});

			guild.addFood(PetConstants.PET_FOOD.ULTIMATE_FOOD, 10, NumberChangeReason.GUILD_DAILY);

			expect(guild.ultimateFood).toBe(caps[3]);
			expect(logsDatabase.logGuildsFoodChanges).toHaveBeenCalledWith(guild, 3, caps[3], NumberChangeReason.GUILD_DAILY);
		});

		it("should remove food and log the new amount", () => {
			const guild = buildGuild({ commonFood: 20 });

			guild.removeFood(PetConstants.PET_FOOD.COMMON_FOOD, 6, NumberChangeReason.PET_FEED);

			expect(guild.commonFood).toBe(14);
			expect(logsDatabase.logGuildsFoodChanges).toHaveBeenCalledWith(guild, 0, 14, NumberChangeReason.PET_FEED);
		});
	});

	describe("score", () => {
		it("should add points to the score and the treasury and set the points mission of every member", async () => {
			vi.spyOn(Players, "getByGuild").mockResolvedValue(members(10));
			const guild = buildGuild({
				score: 100, treasury: 40
			});
			const response: CrowniclesPacket[] = [];

			await guild.addScore({
				amount: 25, response, reason: NumberChangeReason.SMALL_EVENT
			});

			expect(guild.score).toBe(125);
			expect(guild.treasury).toBe(65);
			expect(MissionsController.update).toHaveBeenCalledWith({ id: 10 }, response, {
				missionId: "guildHasPoints", count: 125, set: true
			});
			expect(logsDatabase.logGuildPointsChange).toHaveBeenCalledWith(guild, NumberChangeReason.SMALL_EVENT);
		});

		it("should remove points without touching the treasury nor the missions", async () => {
			const guild = buildGuild({
				score: 100, treasury: 40
			});

			await guild.addScore({
				amount: -30, response: [], reason: NumberChangeReason.SMALL_EVENT
			});

			expect(guild.score).toBe(70);
			expect(guild.treasury).toBe(40);
			expect(MissionsController.update).not.toHaveBeenCalled();
			expect(logsDatabase.logGuildPointsChange).toHaveBeenCalledWith(guild, NumberChangeReason.SMALL_EVENT);
		});

		it("should not update the points mission when no point is won", async () => {
			const guild = buildGuild({
				score: 100, treasury: 40
			});

			await guild.addScore({
				amount: 0, response: [], reason: NumberChangeReason.SMALL_EVENT
			});

			expect(guild.treasury).toBe(40);
			expect(MissionsController.update).not.toHaveBeenCalled();
		});

		it("should not rank a guild without points", async () => {
			const query = vi.spyOn(sequelize, "query");

			expect(await buildGuild({ score: 0 }).getRanking()).toBe(TopConstants.TOP_GUILD_NOT_RANKED_REASON.ZERO_POINTS);
			expect(query).not.toHaveBeenCalled();
		});

		it("should read the rank of the guild", async () => {
			const query = vi.spyOn(sequelize, "query").mockResolvedValue([{ ranking: 4 }] as never);

			expect(await buildGuild({ score: 10 }).getRanking()).toBe(4);
			expect(query.mock.calls[0][1]).toEqual({
				replacements: { id: 3 }, type: QueryTypes.SELECT
			});
		});
	});

	describe("roles and dates", () => {
		it("should recognize the chief and the elder", () => {
			const guild = buildGuild();

			expect(guild.getChiefId()).toBe(10);
			expect(guild.getElderId()).toBe(11);
			expect(guild.isChiefOrElder({ id: 10 } as Player)).toBe(true);
			expect(guild.isChiefOrElder({ id: 11 } as Player)).toBe(true);
			expect(guild.isChiefOrElder({ id: 12 } as Player)).toBe(false);
		});

		it("should set the last daily date to now", () => {
			vi.useFakeTimers({ now: new Date(2026, 2, 10, 12, 0, 0) });
			const guild = buildGuild();

			guild.updateLastDailyAt();

			expect(guild.lastDailyAt).toEqual(new Date(2026, 2, 10, 12, 0, 0));
		});

		it("should refresh the update date before every save", async () => {
			vi.useFakeTimers({ now: new Date(2026, 2, 10, 12, 0, 0) });
			const guild = buildGuild();
			guild.updatedAt = new Date(2020, 0, 1);

			// runHooks exists on every model but is missing from the Sequelize typings
			await (Guild as unknown as { runHooks: (hook: string, ...args: unknown[]) => Promise<void> }).runHooks("beforeSave", guild, {});

			expect(guild.updatedAt).toEqual(new Date(2026, 2, 10, 12, 0, 0));
		});
	});

	it("should accept a guild without domain city", async () => {
		await expect(buildGuild({ domainCityId: null }).validate()).resolves.toBeDefined();
	});

	describe("completelyDestroyAndDeleteFromTheDatabase", () => {
		const fakeTransaction = { id: "tx" } as unknown as Transaction; // Only forwarded to the destroy calls
		let shelteredPets: { petEntityId: number; destroy: ReturnType<typeof vi.fn> }[];
		let petEntity: PetEntity;

		beforeEach(() => {
			shelteredPets = [1, 2].map(petEntityId => ({
				petEntityId, destroy: vi.fn().mockResolvedValue(undefined)
			}));
			petEntity = PetEntity.build({ id: 1 });
			vi.spyOn(GuildPets, "getOfGuild").mockResolvedValue(shelteredPets as unknown as GuildPet[]); // Only destroyed
			// The second pet entity was already deleted
			vi.spyOn(PetEntities, "getById").mockImplementation(id => Promise.resolve(id === 1 ? petEntity : null));
			vi.spyOn(Players, "getByGuild").mockResolvedValue(members(10, 11));
			vi.spyOn(PetEntity, "destroy").mockResolvedValue(1);
			vi.spyOn(Player, "update").mockResolvedValue([2]);
			vi.spyOn(Guild, "destroy").mockResolvedValue(1);
		});

		/**
		 * Check every row of the guild was removed in the given transaction
		 */
		function expectGuildRowsDestroyedIn(transaction: Transaction): void {
			for (const pet of shelteredPets) {
				expect(pet.destroy).toHaveBeenCalledWith({ transaction });
			}
			expect(PetEntity.destroy).toHaveBeenCalledWith({
				where: { id: 1 }, transaction
			});
			expect(PetEntity.destroy).toHaveBeenCalledWith({
				where: { id: 2 }, transaction
			});
			expect(Player.update).toHaveBeenCalledWith({ guildId: null }, {
				where: { guildId: 3 }, transaction
			});
			expect(Guild.destroy).toHaveBeenCalledWith({
				where: { id: 3 }, transaction
			});
		}

		it("should log the destruction and delete the guild, its pets and its memberships in a new transaction", async () => {
			const transaction = vi.spyOn(sequelize, "transaction")
				.mockImplementation(((callback: (t: Transaction) => Promise<void>) => callback(fakeTransaction)) as never);
			const guild = buildGuild();

			await guild.completelyDestroyAndDeleteFromTheDatabase("kc-destroyer");

			expect(logsDatabase.logGuildDestroy).toHaveBeenCalledWith(guild, members(10, 11), [petEntity], "kc-destroyer");
			expect(transaction).toHaveBeenCalledOnce();
			expectGuildRowsDestroyedIn(fakeTransaction);
		});

		it("should reuse the transaction of the caller holding the locks", async () => {
			const transaction = vi.spyOn(sequelize, "transaction");
			const guild = buildGuild();

			await runInChildContext({ [CLS_TRANSACTION_KEY]: fakeTransaction }, () => guild.completelyDestroyAndDeleteFromTheDatabase("kc"));

			expect(transaction).not.toHaveBeenCalled();
			expectGuildRowsDestroyedIn(fakeTransaction);
		});
	});
});

describe("Guilds", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it.each([null, 0])("should not query the database for the empty id %s", async id => {
		const findOne = vi.spyOn(Guild, "findOne");

		expect(await Guilds.getById(id)).toBeNull();
		expect(findOne).not.toHaveBeenCalled();
	});

	it("should look for a guild by id", async () => {
		const guild = buildGuild();
		const findOne = vi.spyOn(Guild, "findOne").mockResolvedValue(guild);

		expect(await Guilds.getById(3)).toBe(guild);
		expect(findOne).toHaveBeenCalledWith({ where: { id: 3 } });
	});

	it("should look for a guild by name", async () => {
		const guild = buildGuild();
		const findOne = vi.spyOn(Guild, "findOne").mockResolvedValue(guild);

		expect(await Guilds.getByName("Les Bricoleurs")).toBe(guild);
		expect(findOne).toHaveBeenCalledWith({ where: { name: "Les Bricoleurs" } });
	});

	it("should round the mean level of the guilds", async () => {
		const query = vi.spyOn(sequelize, "query").mockResolvedValue([{ avg: 12.6 }] as never);

		expect(await Guilds.getGuildLevelMean()).toBe(13);
		expect(query.mock.calls[0][1]).toEqual({ type: QueryTypes.SELECT });
	});

	it("should only count the guilds with points as ranked", async () => {
		const count = vi.spyOn(Guild, "count").mockResolvedValue(8 as never);

		expect(await Guilds.getTotalRanked()).toBe(8);
		expect(count).toHaveBeenCalledWith({ where: { [Op.not]: { score: 0 } } });
	});

	it("should page the ranked guilds by score then level", async () => {
		const findAll = vi.spyOn(Guild, "findAll").mockResolvedValue([]);

		await Guilds.getRankedGuilds(11, 20);

		expect(findAll).toHaveBeenCalledWith({
			where: { [Op.not]: { score: 0 } },
			order: [
				["score", "DESC"],
				["level", "DESC"]
			],
			limit: 10,
			offset: 10
		});
	});

	it("should find the guild of a player", async () => {
		const guild = buildGuild();
		vi.spyOn(Guild, "findOne").mockResolvedValue(guild);

		expect(await Guilds.ofPlayer({ guildId: 3 } as Player)).toBe(guild);
	});

	it("should not find a guild when it cannot be loaded", async () => {
		vi.spyOn(Guild, "findOne").mockRejectedValue(new Error("db down"));

		expect(await Guilds.ofPlayer({ guildId: 3 } as Player)).toBeNull();
	});
});
