import {
	afterEach, describe, expect, it, vi
} from "vitest";
import { Sequelize } from "sequelize";
import InventorySlot, {
	initModel as initInventorySlot, InventorySlots
} from "../../../src/core/database/game/models/InventorySlot";
import Home, { Homes } from "../../../src/core/database/game/models/Home";
import Apartment, { Apartments } from "../../../src/core/database/game/models/Apartment";
import Guild, { Guilds } from "../../../src/core/database/game/models/Guild";
import PetEntity, { PetEntities } from "../../../src/core/database/game/models/PetEntity";
import PlayerTalismans, { PlayerTalismansManager } from "../../../src/core/database/game/models/PlayerTalismans";
import { DwarfPetsSeen } from "../../../src/core/database/game/models/DwarfPetsSeen";
import { IMission } from "../../../src/core/missions/IMission";
import { MissionDifficulty } from "../../../src/core/missions/MissionDifficulty";
import { FightActionController } from "../../../src/core/fights/actions/FightActionController";
import { ClassDataController } from "../../../src/data/Class";
import { MapLocationDataController } from "../../../src/data/MapLocation";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { ItemCategory } from "../../../../Lib/src/constants/ItemConstants";
import { TokensConstants } from "../../../../Lib/src/constants/TokensConstants";
import { getDayNumber } from "../../../../Lib/src/utils/TimeUtils";
import { missionInterface as buyApartment } from "../../../src/core/missions/interfaces/buyApartment";
import { missionInterface as buyApartments } from "../../../src/core/missions/interfaces/buyApartments";
import { missionInterface as buyHome } from "../../../src/core/missions/interfaces/buyHome";
import { missionInterface as buyItemFromAlderic } from "../../../src/core/missions/interfaces/buyItemFromAlderic";
import { missionInterface as chooseClass } from "../../../src/core/missions/interfaces/chooseClass";
import { missionInterface as chooseClassTier } from "../../../src/core/missions/interfaces/chooseClassTier";
import { missionInterface as commandFightHistory } from "../../../src/core/missions/interfaces/commandFightHistory";
import { missionInterface as contributeToBlessing } from "../../../src/core/missions/interfaces/contributeToBlessing";
import { missionInterface as doExpeditions } from "../../../src/core/missions/interfaces/doExpeditions";
import { missionInterface as drinkPotionRarity } from "../../../src/core/missions/interfaces/drinkPotionRarity";
import { missionInterface as expeditionStreak } from "../../../src/core/missions/interfaces/expeditionStreak";
import { missionInterface as fightAttacks } from "../../../src/core/missions/interfaces/fightAttacks";
import { missionInterface as fightHealthPercent } from "../../../src/core/missions/interfaces/fightHealthPercent";
import { missionInterface as fightMinTurns } from "../../../src/core/missions/interfaces/fightMinTurns";
import { missionInterface as fightStreak } from "../../../src/core/missions/interfaces/fightStreak";
import { missionInterface as finishWithAttack } from "../../../src/core/missions/interfaces/finishWithAttack";
import { missionInterface as goToPlace } from "../../../src/core/missions/interfaces/goToPlace";
import { missionInterface as guildLevel } from "../../../src/core/missions/interfaces/guildLevel";
import { missionInterface as haveGardenTalisman } from "../../../src/core/missions/interfaces/haveGardenTalisman";
import { missionInterface as haveItemRarity } from "../../../src/core/missions/interfaces/haveItemRarity";
import { missionInterface as havePet } from "../../../src/core/missions/interfaces/havePet";
import { missionInterface as havePotions } from "../../../src/core/missions/interfaces/havePotions";
import { missionInterface as joinGuild } from "../../../src/core/missions/interfaces/joinGuild";
import { missionInterface as joinGuildHouse } from "../../../src/core/missions/interfaces/joinGuildHouse";
import { missionInterface as longExpedition } from "../../../src/core/missions/interfaces/longExpedition";
import { missionInterface as maxTokensReached } from "../../../src/core/missions/interfaces/maxTokensReached";
import { missionInterface as meetAllOracles } from "../../../src/core/missions/interfaces/meetAllOracles";
import { missionInterface as meetOracle } from "../../../src/core/missions/interfaces/meetOracle";
import { missionInterface as meetSirRowan } from "../../../src/core/missions/interfaces/meetSirRowan";
import { missionInterface as meetTalvar } from "../../../src/core/missions/interfaces/meetTalvar";
import { missionInterface as meetVelanna } from "../../../src/core/missions/interfaces/meetVelanna";
import { missionInterface as petAssistedFight } from "../../../src/core/missions/interfaces/petAssistedFight";
import { missionInterface as petCaress } from "../../../src/core/missions/interfaces/petCaress";
import { missionInterface as reachGlory } from "../../../src/core/missions/interfaces/reachGlory";
import { missionInterface as reachLevel } from "../../../src/core/missions/interfaces/reachLevel";
import { missionInterface as reachScore } from "../../../src/core/missions/interfaces/reachScore";
import { missionInterface as sellItems } from "../../../src/core/missions/interfaces/sellItems";
import { missionInterface as sellItemWithGivenCost } from "../../../src/core/missions/interfaces/sellItemWithGivenCost";
import { missionInterface as showCloneToTalvar } from "../../../src/core/missions/interfaces/showCloneToTalvar";
import { missionInterface as showPetsToTalvar } from "../../../src/core/missions/interfaces/showPetsToTalvar";
import { missionInterface as tamedPet } from "../../../src/core/missions/interfaces/tamedPet";
import { missionInterface as trainedPet } from "../../../src/core/missions/interfaces/trainedPet";
import { missionInterface as travelHours } from "../../../src/core/missions/interfaces/travelHours";
import { missionInterface as upgradeHomeLevel } from "../../../src/core/missions/interfaces/upgradeHomeLevel";
import {
	CITY_NPC_VARIANTS, missionInterface as visitCityNpc
} from "../../../src/core/missions/interfaces/visitCityNpc";
import { missionInterface as winBossWithDifferentClasses } from "../../../src/core/missions/interfaces/winBossWithDifferentClasses";
import { buildPlayer } from "../database/models/PlayerRowFixture";

initInventorySlot(new Sequelize({
	dialect: "mariadb",
	logging: false
}));

const PLAYER_ID = 7;

function inventorySlot(itemCategory: ItemCategory, itemId: number): InventorySlot {
	return InventorySlot.build({
		playerId: PLAYER_ID,
		itemCategory,
		itemId,
		slot: 0
	}, { isNewRecord: false });
}

function petWithLoveLevel(loveLevel: number): PetEntity {
	// Only the love level of the pet is read by the pet missions
	return { getLoveLevelNumber: () => loveLevel } as unknown as PetEntity;
}

function blob(value: string | null): Buffer | null {
	return value === null ? null : Buffer.from(value);
}

describe("Mission interfaces", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	describe("counters of an action", () => {
		it.each([
			["buyItemFromAlderic", buyItemFromAlderic],
			["commandFightHistory", commandFightHistory],
			["contributeToBlessing", contributeToBlessing],
			["doExpeditions", doExpeditions],
			["meetSirRowan", meetSirRowan],
			["meetTalvar", meetTalvar],
			["meetVelanna", meetVelanna],
			["petAssistedFight", petAssistedFight],
			["petCaress", petCaress],
			["sellItems", sellItems],
			["showCloneToTalvar", showCloneToTalvar]
		])("%s counts every action, from zero and without variant nor blob", async (_id, missionInterface: IMission) => {
			const player = buildPlayer({
				level: 80, score: 5000, petId: 3, guildId: 2, class: 16
			});

			expect(missionInterface.areParamsMatchingVariantAndBlob(3, {}, blob("x"))).toBe(true);
			expect(await missionInterface.initialNumberDone(player, 3)).toBe(0);
			expect(missionInterface.generateRandomVariant(MissionDifficulty.HARD, player)).toBe(0);
			expect(missionInterface.updateSaveBlob(3, blob("x"), {})).toBeNull();
		});
	});

	describe("thresholds on a parameter", () => {
		it.each([
			["chooseClassTier", chooseClassTier, "tier"],
			["drinkPotionRarity", drinkPotionRarity, "rarity"],
			["haveItemRarity", haveItemRarity, "rarity"],
			["longExpedition", longExpedition, "durationMinutes"],
			["sellItemWithGivenCost", sellItemWithGivenCost, "itemCost"],
			["travelHours", travelHours, "travelTime"],
			["upgradeHomeLevel", upgradeHomeLevel, "homeLevel"],
			["fightMinTurns", fightMinTurns, "turnCount"]
		])("%s matches a parameter reaching the variant", (_id, missionInterface: IMission, param: string) => {
			expect(missionInterface.areParamsMatchingVariantAndBlob(5, { [param]: 4 }, null)).toBe(false);
			expect(missionInterface.areParamsMatchingVariantAndBlob(5, { [param]: 5 }, null)).toBe(true);
			expect(missionInterface.areParamsMatchingVariantAndBlob(5, { [param]: 6 }, null)).toBe(true);
		});

		it("fightMinTurns ignores a missing or invalid turn count", () => {
			expect(fightMinTurns.areParamsMatchingVariantAndBlob(0, {}, null)).toBe(true);
			expect(fightMinTurns.areParamsMatchingVariantAndBlob(1, {}, null)).toBe(false);
			expect(fightMinTurns.areParamsMatchingVariantAndBlob(0, { turnCount: Infinity }, null)).toBe(false);
			expect(fightMinTurns.areParamsMatchingVariantAndBlob(0, { turnCount: "many" }, null)).toBe(false);
		});

		it("fightHealthPercent matches a fight ended with at most the variant percentage of health", () => {
			expect(fightHealthPercent.areParamsMatchingVariantAndBlob(30, { remainingPercent: 0.29 }, null)).toBe(true);
			expect(fightHealthPercent.areParamsMatchingVariantAndBlob(30, { remainingPercent: 0.3 }, null)).toBe(true);
			expect(fightHealthPercent.areParamsMatchingVariantAndBlob(30, { remainingPercent: 0.31 }, null)).toBe(false);
		});

		it("tamedPet and trainedPet match a pet of love level 4 and 5", () => {
			expect(tamedPet.areParamsMatchingVariantAndBlob(0, { loveLevel: 3 }, null)).toBe(false);
			expect(tamedPet.areParamsMatchingVariantAndBlob(0, { loveLevel: 4 }, null)).toBe(true);
			expect(trainedPet.areParamsMatchingVariantAndBlob(0, { loveLevel: 4 }, null)).toBe(false);
			expect(trainedPet.areParamsMatchingVariantAndBlob(0, { loveLevel: 5 }, null)).toBe(true);
		});
	});

	describe("exact matches", () => {
		it("visitCityNpc matches the npc of the variant", () => {
			expect(visitCityNpc.areParamsMatchingVariantAndBlob(CITY_NPC_VARIANTS.tanner, { npc: CITY_NPC_VARIANTS.tanner }, null)).toBe(true);
			expect(visitCityNpc.areParamsMatchingVariantAndBlob(CITY_NPC_VARIANTS.tanner, { npc: CITY_NPC_VARIANTS.herbalist }, null)).toBe(false);
		});

		it("goToPlace matches the map of the variant", () => {
			expect(goToPlace.areParamsMatchingVariantAndBlob(12, { mapId: 12 }, null)).toBe(true);
			expect(goToPlace.areParamsMatchingVariantAndBlob(12, { mapId: 13 }, null)).toBe(false);
		});

		it("fightAttacks and finishWithAttack match the fight action of the variant", () => {
			const variant = FightActionController.fightActionIdToVariant("piercingAttack");

			expect(fightAttacks.areParamsMatchingVariantAndBlob(variant, { attackType: "piercingAttack" }, null)).toBe(true);
			expect(fightAttacks.areParamsMatchingVariantAndBlob(variant, { attackType: "simpleAttack" }, null)).toBe(false);
			expect(finishWithAttack.areParamsMatchingVariantAndBlob(variant, { lastAttack: "piercingAttack" }, null)).toBe(true);
			expect(finishWithAttack.areParamsMatchingVariantAndBlob(variant, { lastAttack: "simpleAttack" }, null)).toBe(false);
		});

		it("meetOracle matches the tags of an oracle", () => {
			expect(meetOracle.areParamsMatchingVariantAndBlob(0, { tags: ["meetOracleSpace"] }, null)).toBe(true);
			expect(meetOracle.areParamsMatchingVariantAndBlob(0, { tags: [] }, null)).toBe(false);
			expect(meetOracle.generateRandomVariant(MissionDifficulty.EASY, buildPlayer())).toBe(0);
			expect(meetOracle.initialNumberDone(buildPlayer(), 0)).toBe(0);
			expect(meetOracle.updateSaveBlob(0, blob("x"), {})).toBeNull();
		});

		it("meetOracle does not match the tags of another event", () => {
			expect(meetOracle.areParamsMatchingVariantAndBlob(0, { tags: ["bigFeast"] }, null)).toBe(false);
		});

		it("meetOracle matches when one of its tags is among several others", () => {
			expect(meetOracle.areParamsMatchingVariantAndBlob(0, { tags: ["bigFeast", "meetOracleAltar"] }, null)).toBe(true);
		});
	});

	describe("variants", () => {
		it("travelHours asks for longer travels in harder missions", () => {
			const integer = vi.spyOn(RandomUtils.crowniclesRandom, "integer").mockImplementation((min: number) => min);
			const player = buildPlayer();

			expect(travelHours.generateRandomVariant(MissionDifficulty.EASY, player)).toBe(2);
			expect(integer).toHaveBeenLastCalledWith(2, 3);
			expect(travelHours.generateRandomVariant(MissionDifficulty.MEDIUM, player)).toBe(5);
			expect(integer).toHaveBeenLastCalledWith(5, 7);
			expect(travelHours.generateRandomVariant(MissionDifficulty.HARD, player)).toBe(9);
		});

		it("longExpedition asks for longer expeditions in harder missions", () => {
			const player = buildPlayer();

			expect(longExpedition.generateRandomVariant(MissionDifficulty.EASY, player)).toBe(45);
			expect(longExpedition.generateRandomVariant(MissionDifficulty.MEDIUM, player)).toBe(180);
			expect(longExpedition.generateRandomVariant(MissionDifficulty.HARD, player)).toBe(420);
		});

		it.each([
			[MissionDifficulty.EASY, 0, 20],
			[MissionDifficulty.EASY, 2, 21],
			[MissionDifficulty.MEDIUM, 0, 25],
			[MissionDifficulty.MEDIUM, 1, 15],
			[MissionDifficulty.HARD, 0, 25],
			[MissionDifficulty.HARD, 1, 29]
		])("fightMinTurns asks in difficulty %i, drawing its index %i, for %i turns", (difficulty, drawnIndex, turns) => {
			const integer = vi.spyOn(RandomUtils.crowniclesRandom, "integer").mockReturnValue(drawnIndex);

			expect(fightMinTurns.generateRandomVariant(difficulty, buildPlayer())).toBe(turns);
			expect(integer).toHaveBeenCalledWith(0, difficulty === MissionDifficulty.EASY ? 2 : 1);
		});

		it("visitCityNpc draws one of the city npcs", () => {
			const pick = vi.spyOn(RandomUtils.crowniclesRandom, "pick").mockImplementation(values => values[values.length - 1]);

			expect(visitCityNpc.generateRandomVariant(MissionDifficulty.EASY, buildPlayer())).toBe(CITY_NPC_VARIANTS.materialMerchant);
			expect(pick).toHaveBeenCalledWith(Object.values(CITY_NPC_VARIANTS));
		});

		it("goToPlace draws a map players can be sent to", () => {
			const map = MapLocationDataController.instance.getRandomGotoableMap();
			vi.spyOn(MapLocationDataController.instance, "getRandomGotoableMap").mockReturnValue(map);

			expect(goToPlace.generateRandomVariant(MissionDifficulty.EASY, buildPlayer())).toBe(map.id);
		});

		it("fightAttacks and finishWithAttack draw a fight action of the class of the player", () => {
			const pick = vi.spyOn(RandomUtils.crowniclesRandom, "pick").mockImplementation(values => values[1]);
			const player = buildPlayer({ class: 0 });
			const classActions = ClassDataController.instance.getById(0)?.fightActionsIds;
			const expectedVariant = FightActionController.fightActionIdToVariant(classActions?.[1] ?? "");

			expect(fightAttacks.generateRandomVariant(MissionDifficulty.EASY, player)).toBe(expectedVariant);
			expect(finishWithAttack.generateRandomVariant(MissionDifficulty.EASY, player)).toBe(expectedVariant);
			expect(pick).toHaveBeenCalledWith(classActions);
		});
	});

	describe("progress of a player who already fulfils the mission", () => {
		it("reachLevel, reachScore and reachGlory start from the current value", async () => {
			const player = buildPlayer({
				level: 31, score: 4200, attackGloryPoints: 600, defenseGloryPoints: 150
			});

			expect(await reachLevel.initialNumberDone(player, 0)).toBe(31);
			expect(await reachScore.initialNumberDone(player, 0)).toBe(4200);
			expect(await reachGlory.initialNumberDone(player, 0)).toBe(750);
		});

		it("chooseClass is done once the player left the base class", async () => {
			expect(await chooseClass.initialNumberDone(buildPlayer({ class: 0 }), 0)).toBe(0);
			expect(await chooseClass.initialNumberDone(buildPlayer({ class: 3 }), 0)).toBe(1);
		});

		it("chooseClassTier is done once the class of the player reaches the tier", async () => {
			const classGroup = ClassDataController.instance.getById(16)?.classGroup ?? -1;
			const player = buildPlayer({ class: 16 });

			expect(await chooseClassTier.initialNumberDone(player, classGroup)).toBe(1);
			expect(await chooseClassTier.initialNumberDone(player, classGroup + 1)).toBe(0);
		});

		it("havePet and joinGuild are done once the player has a pet or a guild", async () => {
			expect(await havePet.initialNumberDone(buildPlayer({ petId: null }), 0)).toBe(0);
			expect(await havePet.initialNumberDone(buildPlayer({ petId: 4 }), 0)).toBe(1);
			expect(await joinGuild.initialNumberDone(buildPlayer({ guildId: null }), 0)).toBe(0);
			expect(await joinGuild.initialNumberDone(buildPlayer({ guildId: 4 }), 0)).toBe(1);
		});

		it("maxTokensReached is done once the player owns the maximum of tokens", async () => {
			expect(await maxTokensReached.initialNumberDone(buildPlayer({ tokens: TokensConstants.MAX - 1 }), 0)).toBe(0);
			expect(await maxTokensReached.initialNumberDone(buildPlayer({ tokens: TokensConstants.MAX }), 0)).toBe(1);
		});

		it("buyHome is done once the player owns a home", async () => {
			const getOfPlayer = vi.spyOn(Homes, "getOfPlayer").mockResolvedValueOnce(null)
				.mockResolvedValueOnce({ level: 1 } as Home);

			expect(await buyHome.initialNumberDone(buildPlayer(), 0)).toBe(0);
			expect(await buyHome.initialNumberDone(buildPlayer(), 0)).toBe(1);
			expect(getOfPlayer).toHaveBeenCalledWith(PLAYER_ID);
		});

		it("upgradeHomeLevel is done once the home of the player reaches the level", async () => {
			vi.spyOn(Homes, "getOfPlayer").mockResolvedValue({ level: 3 } as Home);

			expect(await upgradeHomeLevel.initialNumberDone(buildPlayer(), 3)).toBe(1);
			expect(await upgradeHomeLevel.initialNumberDone(buildPlayer(), 4)).toBe(0);
		});

		it("upgradeHomeLevel is not done without a home", async () => {
			vi.spyOn(Homes, "getOfPlayer").mockResolvedValue(null);

			expect(await upgradeHomeLevel.initialNumberDone(buildPlayer(), 0)).toBe(0);
		});

		it("buyApartment and buyApartments count the apartments of the player", async () => {
			const getOfPlayer = vi.spyOn(Apartments, "getOfPlayer");
			getOfPlayer.mockResolvedValue([]);

			expect(await buyApartment.initialNumberDone(buildPlayer(), 0)).toBe(0);
			expect(await buyApartments.initialNumberDone(buildPlayer(), 0)).toBe(0);

			getOfPlayer.mockResolvedValue([{} as Apartment, {} as Apartment]);

			expect(await buyApartment.initialNumberDone(buildPlayer(), 0)).toBe(1);
			expect(await buyApartments.initialNumberDone(buildPlayer(), 0)).toBe(2);
			expect(getOfPlayer).toHaveBeenCalledWith(PLAYER_ID);
		});

		it("guildLevel starts from the level of the guild of the player", async () => {
			const getById = vi.spyOn(Guilds, "getById").mockResolvedValueOnce({ level: 12 } as Guild)
				.mockResolvedValueOnce(null);

			expect(await guildLevel.initialNumberDone(buildPlayer({ guildId: 5 }), 0)).toBe(12);
			expect(await guildLevel.initialNumberDone(buildPlayer({ guildId: null }), 0)).toBe(0);
			expect(getById).toHaveBeenCalledWith(5);
		});

		it("joinGuildHouse is done once the guild of the player owns a domain", async () => {
			const getById = vi.spyOn(Guilds, "getById");

			expect(await joinGuildHouse.initialNumberDone(buildPlayer({ guildId: null }), 0)).toBe(0);
			expect(getById).not.toHaveBeenCalled();

			getById.mockResolvedValueOnce({ domainCityId: null } as Guild);
			expect(await joinGuildHouse.initialNumberDone(buildPlayer({ guildId: 5 }), 0)).toBe(0);
			getById.mockResolvedValueOnce({ domainCityId: "boug_coton" } as Guild);
			expect(await joinGuildHouse.initialNumberDone(buildPlayer({ guildId: 5 }), 0)).toBe(1);
			getById.mockResolvedValueOnce(null);
			expect(await joinGuildHouse.initialNumberDone(buildPlayer({ guildId: 5 }), 0)).toBe(0);
			expect(getById).toHaveBeenCalledWith(5);
		});

		it("haveGardenTalisman is done once the player owns the remote harvest talisman", async () => {
			const getOfPlayer = vi.spyOn(PlayerTalismansManager, "getOfPlayer")
				.mockResolvedValueOnce({ hasRemoteHarvestTalisman: false } as PlayerTalismans)
				.mockResolvedValueOnce({ hasRemoteHarvestTalisman: true } as PlayerTalismans);

			expect(await haveGardenTalisman.initialNumberDone(buildPlayer(), 0)).toBe(0);
			expect(await haveGardenTalisman.initialNumberDone(buildPlayer(), 0)).toBe(1);
			expect(getOfPlayer).toHaveBeenCalledWith(PLAYER_ID);
		});

		it("havePotions counts the potions owned, the empty potion slot aside", async () => {
			const getOfPlayer = vi.spyOn(InventorySlots, "getOfPlayer").mockResolvedValue([
				inventorySlot(ItemCategory.POTION, 3),
				inventorySlot(ItemCategory.POTION, 0),
				inventorySlot(ItemCategory.POTION, 5),
				inventorySlot(ItemCategory.WEAPON, 5)
			]);

			expect(await havePotions.initialNumberDone(buildPlayer(), 0)).toBe(2);
			expect(getOfPlayer).toHaveBeenCalledWith(PLAYER_ID);
		});

		it("haveItemRarity is done once the player owns an item of the rarity or better", async () => {
			// The potions 1 and 4 are of rarity 4 and 7
			vi.spyOn(InventorySlots, "getOfPlayer").mockResolvedValue([
				inventorySlot(ItemCategory.POTION, 1),
				inventorySlot(ItemCategory.POTION, 4)
			]);

			expect(await haveItemRarity.initialNumberDone(buildPlayer(), 7)).toBe(1);
			expect(await haveItemRarity.initialNumberDone(buildPlayer(), 8)).toBe(0);
		});

		it("showPetsToTalvar counts the pets already shown", async () => {
			const player = buildPlayer();
			const getPetsSeenId = vi.spyOn(DwarfPetsSeen, "getPetsSeenId").mockResolvedValue([1, 4, 9]);

			expect(await showPetsToTalvar.initialNumberDone(player, 0)).toBe(3);
			expect(getPetsSeenId).toHaveBeenCalledWith(player);
		});

		it("tamedPet and trainedPet are done once the pet of the player is loving enough", async () => {
			const getById = vi.spyOn(PetEntities, "getById").mockResolvedValue(petWithLoveLevel(4));
			const player = buildPlayer({ petId: 8 });

			expect(await tamedPet.initialNumberDone(player, 0)).toBe(1);
			expect(await trainedPet.initialNumberDone(player, 0)).toBe(0);
			expect(getById).toHaveBeenCalledWith(8);

			getById.mockResolvedValue(petWithLoveLevel(5));

			expect(await trainedPet.initialNumberDone(player, 0)).toBe(1);

			getById.mockResolvedValue(petWithLoveLevel(3));

			expect(await tamedPet.initialNumberDone(player, 0)).toBe(0);
		});

		it("tamedPet and trainedPet are not done without a pet", async () => {
			const getById = vi.spyOn(PetEntities, "getById");
			const player = buildPlayer({ petId: null });

			expect(await tamedPet.initialNumberDone(player, 0)).toBe(0);
			expect(await trainedPet.initialNumberDone(player, 0)).toBe(0);
			expect(getById).not.toHaveBeenCalled();
		});
	});

	describe("missions remembering what they saw", () => {
		it("meetAllOracles counts each oracle once", () => {
			expect(meetAllOracles.areParamsMatchingVariantAndBlob(0, { oracleId: "altar" }, null)).toBe(true);
			expect(meetAllOracles.areParamsMatchingVariantAndBlob(0, { oracleId: "altar" }, blob("altar"))).toBe(false);
			expect(meetAllOracles.areParamsMatchingVariantAndBlob(0, { oracleId: "space" }, blob("altar"))).toBe(true);
		});

		it("meetAllOracles records the known oracles it did not see yet", () => {
			const seenAltar = blob("altar");

			expect(meetAllOracles.updateSaveBlob(0, null, { oracleId: "altar" })?.toString()).toBe("altar");
			expect(meetAllOracles.updateSaveBlob(0, seenAltar, { oracleId: "space" })?.toString()).toBe("altar,space");
			expect(meetAllOracles.updateSaveBlob(0, seenAltar, { oracleId: "altar" })).toBe(seenAltar);
			expect(meetAllOracles.updateSaveBlob(0, seenAltar, { oracleId: "unknownOracle" })).toBe(seenAltar);
			expect(meetAllOracles.updateSaveBlob(0, null, { oracleId: "unknownOracle" })).toBeNull();
		});

		it("winBossWithDifferentClasses counts each class once", () => {
			expect(winBossWithDifferentClasses.areParamsMatchingVariantAndBlob(0, { classId: 3 }, null)).toBe(true);
			expect(winBossWithDifferentClasses.areParamsMatchingVariantAndBlob(0, { classId: 3 }, blob("1,3"))).toBe(false);
			expect(winBossWithDifferentClasses.areParamsMatchingVariantAndBlob(0, { classId: 13 }, blob("1,3"))).toBe(true);
			expect(winBossWithDifferentClasses.areParamsMatchingVariantAndBlob(0, { classId: 1 }, blob("13"))).toBe(true);
			expect(winBossWithDifferentClasses.updateSaveBlob(0, null, { classId: 3 })?.toString()).toBe("3");
			expect(winBossWithDifferentClasses.updateSaveBlob(0, blob("3"), { classId: 13 })?.toString()).toBe("3,13");
		});

		it.each([
			["fightStreak", fightStreak],
			["expeditionStreak", expeditionStreak]
		])("%s records the day of the last success", (_id, missionInterface: IMission) => {
			vi.useFakeTimers({ now: Date.UTC(2026, 10, 21, 12) });

			const saveBlob = missionInterface.updateSaveBlob(0, null, {});

			expect(saveBlob?.length).toBe(4);
			expect(saveBlob?.readInt32LE()).toBe(getDayNumber());
			expect(missionInterface.areParamsMatchingVariantAndBlob(0, {}, saveBlob)).toBe(true);
			expect(missionInterface.initialNumberDone(buildPlayer(), 0)).toBe(0);
			expect(missionInterface.generateRandomVariant(MissionDifficulty.EASY, buildPlayer())).toBe(0);
		});
	});
});
