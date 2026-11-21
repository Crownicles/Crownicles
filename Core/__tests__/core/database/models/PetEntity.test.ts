import {
	afterEach, beforeEach, describe, expect, it, vi
} from "vitest";
import {
	QueryTypes, Sequelize
} from "sequelize";
import PetEntity, {
	initModel as initPetEntity, PetEntities
} from "../../../../src/core/database/game/models/PetEntity";
import { initModel as initGuild } from "../../../../src/core/database/game/models/Guild";
import Player from "../../../../src/core/database/game/models/Player";
import {
	Guild, Guilds
} from "../../../../src/core/database/game/models/Guild";
import {
	GuildPet, GuildPets
} from "../../../../src/core/database/game/models/GuildPet";
import { MissionsController } from "../../../../src/core/missions/MissionsController";
import { BlessingManager } from "../../../../src/core/blessings/BlessingManager";
import { Crownicles } from "../../../../src/core/bot/Crownicles";
import { setCrowniclesInstanceForTests } from "../../../../src/app";
import { PetUtils } from "../../../../src/core/utils/PetUtils";
import {
	Pet, PetDataController
} from "../../../../src/data/Pet";
import {
	PET_ENTITY_GIVE_RETURN, PetConstants
} from "../../../../../Lib/src/constants/PetConstants";
import { NumberChangeReason } from "../../../../../Lib/src/constants/LogsConstants";
import { CrowniclesPacket } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { PlayerReceivePetPacket } from "../../../../../Lib/src/packets/events/PlayerReceivePetPacket";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";
import { CrowniclesLogger } from "../../../../../Lib/src/logs/CrowniclesLogger";

vi.mock("../../../../src/core/missions/MissionsController", () => ({
	MissionsController: { update: vi.fn().mockResolvedValue(undefined) }
}));

const sequelize = new Sequelize({
	dialect: "mariadb", logging: false
});
initPetEntity(sequelize);
initGuild(sequelize);

const MINUTE_MS = 60_000;
const CARNIVOROUS_PET_ID = 1;
const HERBIVOROUS_PET_ID = 6;

/**
 * Get a pet model of the data files
 */
function petModel(typeId: number): Pet {
	const pet = PetDataController.instance.getById(typeId);
	if (!pet) {
		throw new Error(`No pet ${typeId} in the data files`);
	}
	return pet;
}

/**
 * Build an unsaved pet entity
 */
function buildPet(values: Partial<{
	typeId: number; sex: string; nickname: string | null; lovePoints: number; hungrySince: Date | null;
}> = {}): PetEntity {
	return PetEntity.build({
		typeId: CARNIVOROUS_PET_ID,
		sex: "m",
		nickname: "Rex",
		lovePoints: PetConstants.BASE_LOVE,
		...values
	});
}

describe("PetEntity", () => {
	const logPetLoveChange = vi.fn().mockResolvedValue(undefined);

	beforeEach(() => {
		vi.clearAllMocks();
		setCrowniclesInstanceForTests({
			logsDatabase: { logPetLoveChange }
		} as unknown as Crownicles); // Only the log used by the pet love changes
	});

	afterEach(() => {
		setCrowniclesInstanceForTests(null);
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	describe("feed cooldown", () => {
		it("should have no cooldown when the pet is not hungry", () => {
			expect(buildPet({ hungrySince: null }).getFeedCooldown(petModel(CARNIVOROUS_PET_ID))).toBe(0);
		});

		it("should scale the cooldown with the feed delay of the pet and remove the elapsed time", () => {
			vi.useFakeTimers({ now: new Date(2026, 2, 10, 12, 0, 0) });
			const pet = buildPet({ hungrySince: new Date(Date.now() - 10 * MINUTE_MS) });

			// Feed delay 3 -> 3 x 30 minutes, 10 minutes ago
			expect(pet.getFeedCooldown(petModel(CARNIVOROUS_PET_ID))).toBe(80 * MINUTE_MS);
		});

		it("should use a feed delay of 1 when the pet has none", () => {
			vi.useFakeTimers({ now: new Date(2026, 2, 10, 12, 0, 0) });
			const pet = buildPet({ hungrySince: new Date(Date.now() - 10 * MINUTE_MS) });

			expect(pet.getFeedCooldown({} as Pet)).toBe(20 * MINUTE_MS);
		});

		it("should be fed once the cooldown is exactly over with a food of its diet", () => {
			vi.useFakeTimers({ now: new Date(2026, 2, 10, 12, 0, 0) });
			const pet = buildPet({
				typeId: HERBIVOROUS_PET_ID,
				hungrySince: new Date(Date.now() - PetConstants.BREED_COOLDOWN)
			});

			expect(pet.canBeFed(petModel(HERBIVOROUS_PET_ID), PetConstants.PET_FOOD.HERBIVOROUS_FOOD)).toBe(true);
		});

		it("should not be fed during the cooldown", () => {
			vi.useFakeTimers({ now: new Date(2026, 2, 10, 12, 0, 0) });
			const pet = buildPet({
				typeId: HERBIVOROUS_PET_ID,
				hungrySince: new Date(Date.now() - PetConstants.BREED_COOLDOWN + 1)
			});

			expect(pet.canBeFed(petModel(HERBIVOROUS_PET_ID), PetConstants.PET_FOOD.HERBIVOROUS_FOOD)).toBe(false);
		});

		it("should not be fed with a food outside its diet", () => {
			const pet = buildPet({
				typeId: HERBIVOROUS_PET_ID, hungrySince: null
			});

			expect(pet.canBeFed(petModel(HERBIVOROUS_PET_ID), PetConstants.PET_FOOD.CARNIVOROUS_FOOD)).toBe(false);
		});
	});

	describe("love level", () => {
		it.each([
			[0, PetConstants.LOVE_LEVEL.FEISTY],
			[4, PetConstants.LOVE_LEVEL.FEISTY],
			[5, PetConstants.LOVE_LEVEL.WILD],
			[19, PetConstants.LOVE_LEVEL.WILD],
			[20, PetConstants.LOVE_LEVEL.FEARFUL],
			[49, PetConstants.LOVE_LEVEL.FEARFUL],
			[50, PetConstants.LOVE_LEVEL.TAMED],
			[99, PetConstants.LOVE_LEVEL.TAMED],
			[100, PetConstants.LOVE_LEVEL.TRAINED],
			[110, PetConstants.LOVE_LEVEL.TRAINED]
		])("should give %s love points the level %s", (lovePoints, level) => {
			expect(buildPet({ lovePoints }).getLoveLevelNumber()).toBe(level);
		});

		it.each([
			[4, true],
			[5, false]
		])("should consider a pet with %s love points feisty: %s", (lovePoints, feisty) => {
			expect(buildPet({ lovePoints }).isFeisty()).toBe(feisty);
		});

		it.each([
			[49, true],
			[50, false]
		])("should consider a pet with %s love points in need of veterinarian care: %s", (lovePoints, needsCare) => {
			expect(buildPet({ lovePoints }).needsVeterinarianCare()).toBe(needsCare);
		});
	});

	describe("changeLovePoints", () => {
		const player = { keycloakId: "kc" } as Player;

		/**
		 * Change the love points of a pet and return the response used
		 */
		async function changeLove(pet: PetEntity, amount: number): Promise<CrowniclesPacket[]> {
			const response: CrowniclesPacket[] = [];
			await pet.changeLovePoints({
				player, amount, response, reason: NumberChangeReason.PET_FEED
			});
			return response;
		}

		it("should multiply and round love gains with the pet love blessing", async () => {
			vi.spyOn(BlessingManager.getInstance(), "getPetLoveMultiplier").mockReturnValue(1.5);
			const pet = buildPet({ lovePoints: 10 });

			await changeLove(pet, 3);

			expect(pet.lovePoints).toBe(15);
		});

		it("should not multiply love losses", async () => {
			vi.spyOn(BlessingManager.getInstance(), "getPetLoveMultiplier").mockReturnValue(2);
			const pet = buildPet({ lovePoints: 10 });

			await changeLove(pet, -4);

			expect(pet.lovePoints).toBe(6);
		});

		it("should cap the love points at MAX_LOVE_POINTS", async () => {
			const pet = buildPet({ lovePoints: 105 });

			await changeLove(pet, 10);

			expect(pet.lovePoints).toBe(PetConstants.MAX_LOVE_POINTS);
		});

		it("should reach exactly MAX_LOVE_POINTS", async () => {
			const pet = buildPet({ lovePoints: 100 });

			await changeLove(pet, 10);

			expect(pet.lovePoints).toBe(PetConstants.MAX_LOVE_POINTS);
		});

		it("should not go under 0 love points", async () => {
			const pet = buildPet({ lovePoints: 3 });

			await changeLove(pet, -10);

			expect(pet.lovePoints).toBe(0);
		});

		it("should log the change and update the love level missions with the new level", async () => {
			const pet = buildPet({ lovePoints: 45 });

			const response = await changeLove(pet, 5);

			expect(logPetLoveChange).toHaveBeenCalledWith(pet, NumberChangeReason.PET_FEED, "kc");
			expect(vi.mocked(MissionsController.update).mock.calls).toEqual([
				[player, response, {
					missionId: "tamedPet", params: { loveLevel: PetConstants.LOVE_LEVEL.TAMED }
				}],
				[player, response, {
					missionId: "trainedPet", params: { loveLevel: PetConstants.LOVE_LEVEL.TAMED }
				}]
			]);
		});
	});

	describe("giveToPlayer", () => {
		let pet: PetEntity;
		let player: Player;
		let guildPetSave: ReturnType<typeof vi.fn>;

		beforeEach(() => {
			pet = buildPet({
				typeId: HERBIVOROUS_PET_ID, sex: "f"
			});
			vi.spyOn(pet, "save").mockResolvedValue(pet);
			// Only what giving a pet reads and writes on the player
			player = {
				guildId: 3,
				petId: null,
				setPet: vi.fn(),
				save: vi.fn().mockResolvedValue(undefined)
			} as unknown as Player;
			guildPetSave = vi.fn().mockResolvedValue(undefined);
			vi.spyOn(GuildPets, "addPet").mockReturnValue({ save: guildPetSave } as unknown as GuildPet); // Only saved by the caller
		});

		/**
		 * Make the player's guild shelter hold `petCount` pets out of `shelterLevel` capacity
		 */
		function guildWithShelter(petCount: number, shelterLevel = 1): Guild {
			const guild = Guild.build({
				id: 3, shelterLevel
			});
			vi.spyOn(Guilds, "getById").mockResolvedValue(guild);
			vi.spyOn(GuildPets, "getOfGuild").mockResolvedValue(new Array(petCount).fill({}) as GuildPet[]);
			return guild;
		}

		/**
		 * Give the pet and return the result with the sent packet
		 */
		async function give(): Promise<{
			result: PET_ENTITY_GIVE_RETURN; packet: CrowniclesPacket;
		}> {
			const response: CrowniclesPacket[] = [];
			const result = await pet.giveToPlayer(player, response);
			expect(response).toHaveLength(1);
			return {
				result, packet: response[0]
			};
		}

		it("should give the pet to a player without pet", async () => {
			guildWithShelter(0);

			const {
				result, packet
			} = await give();

			expect(result).toBe(PET_ENTITY_GIVE_RETURN.PLAYER);
			expect(pet.save).toHaveBeenCalledOnce();
			expect(player.setPet).toHaveBeenCalledWith(pet);
			expect(player.save).toHaveBeenCalledOnce();
			expect(MissionsController.update).toHaveBeenCalledWith(player, expect.any(Array), { missionId: "havePet" });
			expect(GuildPets.addPet).not.toHaveBeenCalled();
			expect(packet).toBeInstanceOf(PlayerReceivePetPacket);
			expect({ ...packet }).toEqual({
				giveInGuild: false,
				giveInPlayerInv: true,
				noRoomInGuild: false,
				petTypeId: HERBIVOROUS_PET_ID,
				petSex: "f"
			});
		});

		it("should give the pet to a player without pet nor guild", async () => {
			vi.spyOn(Guilds, "getById").mockResolvedValue(null);

			const { result } = await give();

			expect(result).toBe(PET_ENTITY_GIVE_RETURN.PLAYER);
			expect(player.setPet).toHaveBeenCalledWith(pet);
		});

		it("should send the pet to the guild shelter when the player already has one", async () => {
			const guild = guildWithShelter(0);
			player.petId = 12;

			const {
				result, packet
			} = await give();

			expect(result).toBe(PET_ENTITY_GIVE_RETURN.GUILD);
			expect(pet.save).toHaveBeenCalledOnce();
			expect(GuildPets.addPet).toHaveBeenCalledWith(guild, pet, true);
			expect(guildPetSave).toHaveBeenCalledOnce();
			expect(player.setPet).not.toHaveBeenCalled();
			expect(packet).toMatchObject({
				giveInGuild: true, giveInPlayerInv: false, noRoomInGuild: false
			});
		});

		it("should not give the pet when the player has one and the shelter is full", async () => {
			const guild = guildWithShelter(0);
			vi.spyOn(GuildPets, "getOfGuild").mockResolvedValue(new Array(guild.getShelterCapacity()).fill({}) as GuildPet[]);
			player.petId = 12;

			const {
				result, packet
			} = await give();

			expect(result).toBe(PET_ENTITY_GIVE_RETURN.NO_SLOT);
			expect(pet.save).not.toHaveBeenCalled();
			expect(GuildPets.addPet).not.toHaveBeenCalled();
			expect(packet).toMatchObject({
				giveInGuild: false, giveInPlayerInv: false, noRoomInGuild: true
			});
		});

		it.each([
			["has no guild", (): void => {
				vi.spyOn(Guilds, "getById").mockResolvedValue(null);
			}],
			["guild cannot be loaded", (): void => {
				vi.spyOn(Guilds, "getById").mockRejectedValue(new Error("db down"));
			}]
		])("should not give the pet when the player has one and %s", async (_name, setupGuild) => {
			setupGuild();
			player.petId = 12;

			const { result } = await give();

			expect(result).toBe(PET_ENTITY_GIVE_RETURN.NO_SLOT);
			expect(pet.save).not.toHaveBeenCalled();
		});
	});

	it("should refresh the update date before every save", async () => {
		vi.useFakeTimers({ now: new Date(2026, 2, 10, 12, 0, 0) });
		const pet = buildPet();
		pet.updatedAt = new Date(2020, 0, 1);

		// runHooks exists on every model but is missing from the Sequelize typings
		await (PetEntity as unknown as { runHooks: (hook: string, ...args: unknown[]) => Promise<void> }).runHooks("beforeSave", pet, {});

		expect(pet.updatedAt).toEqual(new Date(2026, 2, 10, 12, 0, 0));
	});

	describe("descriptions", () => {
		it.each([
			["f", true],
			["m", false]
		])("should tell whether the sex %s is female: %s", (sex, female) => {
			expect(buildPet({ sex }).isFemale()).toBe(female);
		});

		it("should describe the pet with the data of its type", () => {
			const model = petModel(CARNIVOROUS_PET_ID);

			expect(buildPet({
				lovePoints: 60, nickname: "Rex", sex: "m"
			}).asOwnedPet()).toEqual({
				typeId: CARNIVOROUS_PET_ID,
				nickname: "Rex",
				rarity: model.rarity,
				sex: "m",
				loveLevel: PetConstants.LOVE_LEVEL.TAMED,
				force: model.force,
				feedDelay: model.feedDelay
			});
		});

		it("should fail to describe a pet of an unknown type", () => {
			expect(() => buildPet({ typeId: 99999 }).asOwnedPet()).toThrow("Pet model not found for typeId 99999");
		});

		it("should give the basic info of the pet", () => {
			expect(buildPet({
				typeId: 7, sex: "f", nickname: "Kiki"
			}).getBasicInfo()).toEqual({
				petTypeId: 7, petSex: "f", petNickname: "Kiki"
			});
		});
	});
});

describe("PetEntities", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("getById", () => {
		it.each([null, 0])("should not query the database for the empty id %s", async id => {
			const findOne = vi.spyOn(PetEntity, "findOne");

			expect(await PetEntities.getById(id)).toBeNull();
			expect(findOne).not.toHaveBeenCalled();
		});

		it("should look for the pet by id", async () => {
			const pet = buildPet();
			const findOne = vi.spyOn(PetEntity, "findOne").mockResolvedValue(pet);

			expect(await PetEntities.getById(8)).toBe(pet);
			expect(findOne).toHaveBeenCalledWith({ where: { id: 8 } });
		});
	});

	it("should create a pet with the base love", () => {
		const pet = PetEntities.createPet(7, "f", "Kiki");

		expect(pet.isNewRecord).toBe(true);
		expect(pet.getBasicInfo()).toEqual({
			petTypeId: 7, petSex: "f", petNickname: "Kiki"
		});
		expect(pet.lovePoints).toBe(PetConstants.BASE_LOVE);
	});

	describe("generateRandomPetEntity", () => {
		it.each([
			[true, "m"],
			[false, "f"]
		])("should generate a pet of the drawn rarity (male draw %s gives %s)", (maleDraw, sex) => {
			vi.spyOn(RandomUtils.crowniclesRandom, "bool").mockReturnValue(maleDraw);
			const generateRarity = vi.spyOn(PetUtils, "generateRandomPetRarity").mockReturnValue(4);

			const pet = PetEntities.generateRandomPetEntity(2, 6);

			expect(generateRarity).toHaveBeenCalledWith(2, 6);
			expect(pet.sex).toBe(sex);
			expect(petModel(pet.typeId).rarity).toBe(4);
			expect(pet.lovePoints).toBe(PetConstants.BASE_LOVE);
			expect(pet.nickname).toBeNull();
		});

		it("should fall back on any pet when no pet has the drawn rarity", () => {
			vi.spyOn(PetUtils, "generateRandomPetRarity").mockReturnValue(4);
			const fallback = petModel(HERBIVOROUS_PET_ID);
			const getRandom = vi.spyOn(PetDataController.instance, "getRandom")
				.mockReturnValueOnce(undefined as unknown as Pet) // No pet of the rarity
				.mockReturnValueOnce(fallback);
			const warn = vi.spyOn(CrowniclesLogger, "warn").mockImplementation(() => undefined);

			const pet = PetEntities.generateRandomPetEntity();

			expect(getRandom).toHaveBeenNthCalledWith(1, 4);
			expect(getRandom).toHaveBeenNthCalledWith(2);
			expect(warn).toHaveBeenCalledOnce();
			expect(pet.typeId).toBe(HERBIVOROUS_PET_ID);
		});

		it("should use the whole pet rarity range by default", () => {
			const generateRarity = vi.spyOn(PetUtils, "generateRandomPetRarity").mockReturnValue(1);

			PetEntities.generateRandomPetEntityNotGuild();

			expect(generateRarity).toHaveBeenCalledWith(PetConstants.PET_RARITY_RANGE.MIN, PetConstants.PET_RARITY_RANGE.MAX);
		});

		it("should forward the rarity range for a player without guild", () => {
			const generateRarity = vi.spyOn(PetUtils, "generateRandomPetRarity").mockReturnValue(1);

			PetEntities.generateRandomPetEntityNotGuild(3, 5);

			expect(generateRarity).toHaveBeenCalledWith(3, 5);
		});
	});

	describe("statistics", () => {
		it("should count the pets at least trained", async () => {
			const query = vi.spyOn(sequelize, "query").mockResolvedValue([{ count: 7 }] as never);

			expect(await PetEntities.getNbTrainedPets()).toBe(7);
			expect(query.mock.calls[0][0]).toMatch(new RegExp(`WHERE lovePoints >= ${PetConstants.TRAINED_LOVE_THRESHOLD}$`));
			expect(query.mock.calls[0][1]).toEqual({ type: QueryTypes.SELECT });
		});

		it("should count the feisty pets", async () => {
			const query = vi.spyOn(sequelize, "query").mockResolvedValue([{ count: 3 }] as never);

			expect(await PetEntities.getNbFeistyPets()).toBe(3);
			expect(query.mock.calls[0][0]).toMatch(new RegExp(`WHERE lovePoints <= ${PetConstants.LOVE_LEVELS[0]}$`));
			expect(query.mock.calls[0][1]).toEqual({ type: QueryTypes.SELECT });
		});

		it("should count the pets of a sex", async () => {
			const query = vi.spyOn(sequelize, "query").mockResolvedValue([{ count: 11 }] as never);

			expect(await PetEntities.getNbPetsGivenSex("f")).toBe(11);
			expect(query.mock.calls[0][0]).toMatch(/WHERE sex = :sex$/);
			expect(query.mock.calls[0][1]).toEqual({
				type: QueryTypes.SELECT, replacements: { sex: "f" }
			});
		});

		it("should count every pet", async () => {
			const query = vi.spyOn(sequelize, "query").mockResolvedValue([{ count: 42 }] as never);

			expect(await PetEntities.getNbPets()).toBe(42);
			expect(query.mock.calls[0][0]).toMatch(/^SELECT COUNT\(\*\) as count\s+FROM pet_entities$/);
			expect(query.mock.calls[0][1]).toEqual({ type: QueryTypes.SELECT });
		});
	});
});
