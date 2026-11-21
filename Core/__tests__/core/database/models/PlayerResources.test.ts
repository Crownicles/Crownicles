import {
	beforeEach, describe, expect, it, vi
} from "vitest";
import Player from "../../../../src/core/database/game/models/Player";
import { RecipeDiscoveryService } from "../../../../src/core/cooking/RecipeDiscoveryService";
import { applyKingChallengeProgressUnderLock } from "../../../../src/core/kingChallenge/KingChallenge";
import { UnsavedPlayerChangesError } from "../../../../src/core/missions/MissionsController";
import { CrowniclesPacket } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { PlayerLevelUpPacket } from "../../../../../Lib/src/packets/events/PlayerLevelUpPacket";
import { NumberChangeReason } from "../../../../../Lib/src/constants/LogsConstants";
import {
	RecipeDiscoverySource, RecipeType
} from "../../../../../Lib/src/constants/CookingConstants";
import { RecipeDisplayInfo } from "../../../../../Lib/src/types/CookingTypes";
import { TokensConstants } from "../../../../../Lib/src/constants/TokensConstants";
import { getCrowniclesNamespace } from "../../../../../Lib/src/locks/CLSNamespace";
import { PlayerActiveObjects } from "../../../../src/core/database/game/models/PlayerActiveObjects";
import { Maps } from "../../../../src/core/maps/Maps";
import { TravelTime } from "../../../../src/core/maps/TravelTime";
import { PlayerSmallEvents } from "../../../../src/core/database/game/models/PlayerSmallEvent";
import Guild, { Guilds } from "../../../../src/core/database/game/models/Guild";
import { MapLinkDataController } from "../../../../src/data/MapLink";
import { PlayerLeavePveIslandPacket } from "../../../../../Lib/src/packets/events/PlayerLeavePveIslandPacket";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";
import { MapConstants } from "../../../../../Lib/src/constants/MapConstants";
import { Effect } from "../../../../../Lib/src/types/Effect";
import {
	KEYCLOAK_ID, PLAYER_ID, setupPlayerRowHarness
} from "./PlayerRowFixture";

const REASON = NumberChangeReason.TEST;

function levelUpPackets(response: CrowniclesPacket[]): PlayerLevelUpPacket[] {
	return response.filter((packet): packet is PlayerLevelUpPacket => packet instanceof PlayerLevelUpPacket);
}

describe("Player resources", () => {
	const harness = setupPlayerRowHarness();

	describe("addMoney", () => {
		it("credits the gain on the locked row, progresses the earnMoney mission and synchronizes the caller", async () => {
			harness.row.money = 150;
			const player = harness.caller({ money: 100 });

			expect(await player.addMoney({
				amount: 40, response: [], reason: REASON
			})).toBe(player);

			expect(harness.row.money).toBe(190);
			expect(player.money).toBe(190);
			expect(harness.missionUpdates).toEqual([{
				missionId: "earnMoney", count: 40, set: false
			}]);
			expect(harness.logs.logMoneyChange).toHaveBeenCalledWith(KEYCLOAK_ID, 190, REASON);
		});

		it("applies the money blessing to a gain, unless ignored", async () => {
			harness.blessings.moneyMultiplier = 1.5;
			const player = harness.caller();

			await player.addMoney({
				amount: 40, response: [], reason: REASON
			});

			expect(player.money).toBe(60);
			expect(harness.missionUpdates[0].count).toBe(60);

			await player.addMoney({
				amount: 40, response: [], reason: REASON, ignoreBlessing: true
			});

			expect(player.money).toBe(100);
			expect(harness.missionUpdates[1].count).toBe(40);
		});

		it("removes a loss without progressing a mission, never below 0", async () => {
			harness.row.money = 30;
			const player = harness.caller();

			await player.addMoney({
				amount: -20, response: [], reason: REASON
			});

			expect(player.money).toBe(10);

			await player.addMoney({
				amount: -20, response: [], reason: REASON
			});

			expect(player.money).toBe(0);
			expect(harness.row.money).toBe(0);
			expect(harness.missionUpdates).toEqual([]);
			expect(harness.logs.logMoneyChange).toHaveBeenLastCalledWith(KEYCLOAK_ID, 0, REASON);
		});

		it("applies a loss on the locked row rather than on a stale caller", async () => {
			harness.row.money = 500;
			const player = harness.caller({ money: 30 });

			await player.addMoney({
				amount: -20, response: [], reason: REASON
			});

			expect(player.money).toBe(480);
		});

		it("refuses to overwrite unsaved changes of the caller", async () => {
			const player = harness.caller();
			player.level = 99;

			await expect(player.addMoney({
				amount: -20, response: [], reason: REASON
			})).rejects.toThrow(UnsavedPlayerChangesError);
			await expect(player.addMoney({
				amount: 20, response: [], reason: REASON
			})).rejects.toThrow(UnsavedPlayerChangesError);
			expect(harness.row.money).toBe(0);
		});
	});

	describe("spendMoney", () => {
		it("removes the spent amount, whatever its sign, and progresses the spendMoney mission", async () => {
			harness.row.money = 100;
			const player = harness.caller();

			await player.spendMoney({
				amount: -30, response: [], reason: REASON
			});
			await player.spendMoney({
				amount: 20, response: [], reason: REASON
			});

			expect(player.money).toBe(50);
			expect(harness.missionUpdates).toEqual([{
				missionId: "spendMoney", count: 30, set: false
			}, {
				missionId: "spendMoney", count: 20, set: false
			}]);
			expect(harness.logs.logMoneyChange).toHaveBeenLastCalledWith(KEYCLOAK_ID, 50, REASON);
		});

		it("never makes the money negative", async () => {
			harness.row.money = 10;
			const player = harness.caller();

			await player.spendMoney({
				amount: 30, response: [], reason: REASON
			});

			expect(player.money).toBe(0);
		});
	});

	describe("addScore", () => {
		it("adds the gain to the score and the weekly score, with the score blessing", async () => {
			harness.blessings.scoreMultiplier = 1.1;
			harness.row.score = 1000;
			harness.row.weeklyScore = 200;
			const player = harness.caller({ score: 0 });

			expect(await player.addScore({
				amount: 25, response: [], reason: REASON
			})).toBe(player);

			// 25 * 1.1 = 27.5, rounded to 28
			expect(player.score).toBe(1028);
			expect(player.weeklyScore).toBe(228);
			expect(harness.missionUpdates).toEqual([{
				missionId: "earnPoints", count: 28, set: false
			}, {
				missionId: "reachScore", count: 1028, set: true
			}]);
			expect(harness.followUps).toEqual([applyKingChallengeProgressUnderLock]);
			expect(harness.logs.logScoreChange).toHaveBeenCalledWith(KEYCLOAK_ID, 1028, REASON);
		});

		it("does not apply the blessing when ignored", async () => {
			harness.blessings.scoreMultiplier = 1.1;
			const player = harness.caller();

			await player.addScore({
				amount: 25, response: [], reason: REASON, ignoreBlessing: true
			});

			expect(player.score).toBe(25);
		});

		it("removes a loss without the blessing nor the earnPoints mission, never below 0", async () => {
			harness.blessings.scoreMultiplier = 2;
			harness.row.score = 100;
			harness.row.weeklyScore = 30;
			const player = harness.caller();

			await player.addScore({
				amount: -40, response: [], reason: REASON
			});

			expect(player.score).toBe(60);
			expect(player.weeklyScore).toBe(0);
			expect(harness.missionUpdates).toEqual([{
				missionId: "reachScore", count: 60, set: true
			}]);

			await player.addScore({
				amount: -100, response: [], reason: REASON
			});

			expect(player.score).toBe(0);
		});

		it("removes a loss from the weekly score", async () => {
			harness.row.score = 100;
			harness.row.weeklyScore = 30;
			const player = harness.caller();

			await player.addScore({
				amount: -10, response: [], reason: REASON
			});

			expect(player.weeklyScore).toBe(20);
		});

		it("does not progress the earnPoints mission for a null gain", async () => {
			const player = harness.caller();

			await player.addScore({
				amount: 0, response: [], reason: REASON
			});

			expect(harness.missionUpdates.map(update => update.missionId)).toEqual(["reachScore"]);
		});
	});

	describe("addExperience and level ups", () => {
		it("adds a gain below the next level and progresses the earnXP mission", async () => {
			harness.row.experience = 100;
			const player = harness.caller();
			const response: CrowniclesPacket[] = [];

			expect(await player.addExperience({
				amount: 50, response, reason: REASON
			})).toBe(player);

			expect(player.experience).toBe(150);
			expect(player.level).toBe(10);
			expect(harness.missionUpdates).toEqual([{
				missionId: "earnXP", count: 50, set: false
			}]);
			expect(harness.logs.logExperienceChange).toHaveBeenCalledWith(KEYCLOAK_ID, 150, REASON);
			expect(levelUpPackets(response)).toHaveLength(0);
		});

		it("removes a loss without progressing a mission", async () => {
			harness.row.experience = 100;
			const player = harness.caller();

			await player.addExperience({
				amount: -30, response: [], reason: REASON
			});

			expect(player.experience).toBe(70);
			expect(harness.missionUpdates).toEqual([]);
		});

		it("levels up as many times as the experience allows, keeping the remaining experience", async () => {
			const syncProgressionRecipes = vi.spyOn(RecipeDiscoveryService, "syncProgressionRecipes").mockResolvedValue([]);
			harness.row.level = 9;
			harness.row.experience = 0;
			const player = harness.caller();
			const response: CrowniclesPacket[] = [];

			// 298 to reach level 10, 318 to reach level 11, 338 to reach level 12
			await player.addExperience({
				amount: 298 + 318 + 5, response, reason: REASON
			});

			expect(player.level).toBe(11);
			expect(player.experience).toBe(5);
			expect(harness.row).toMatchObject({
				level: 11, experience: 5
			});
			expect(harness.missionUpdates.filter(update => update.missionId === "reachLevel")).toEqual([{
				missionId: "reachLevel", count: 10, set: true
			}, {
				missionId: "reachLevel", count: 11, set: true
			}]);
			expect(levelUpPackets(response).map(packet => packet.level)).toEqual([10, 11]);
			expect(syncProgressionRecipes).toHaveBeenCalledWith(player, RecipeDiscoverySource.PLAYER_LEVEL_MILESTONE, 10);
			expect(syncProgressionRecipes).toHaveBeenCalledWith(player, RecipeDiscoverySource.PLAYER_LEVEL_MILESTONE, 11);
			expect(harness.logs.logLevelChange).toHaveBeenCalledWith(KEYCLOAK_ID, 11);
			expect(harness.logs.logExperienceChange).toHaveBeenCalledWith(KEYCLOAK_ID, 5, NumberChangeReason.LEVEL_UP);
		});

		it("levels up with exactly the experience needed", async () => {
			vi.spyOn(RecipeDiscoveryService, "syncProgressionRecipes").mockResolvedValue([]);
			harness.row.level = 11;
			const player = harness.caller();

			await player.addExperience({
				amount: 338, response: [], reason: REASON
			});

			expect(player.level).toBe(12);
			expect(player.experience).toBe(0);
		});

		it("does not level up when a concurrent update already consumed the experience", async () => {
			vi.spyOn(RecipeDiscoveryService, "syncProgressionRecipes").mockResolvedValue([]);
			harness.row.level = 11;
			harness.row.experience = 400;
			const player = harness.caller({
				level: 10, experience: 400
			});
			const response: CrowniclesPacket[] = [];

			await player.levelUpIfNeeded(response);

			expect(player.level).toBe(12);
			expect(player.experience).toBe(62);
			expect(levelUpPackets(response).map(packet => packet.level)).toEqual([12]);

			harness.row.level = 12;
			harness.row.experience = 0;
			const stale = harness.caller({
				level: 10, experience: 400
			});
			const staleResponse: CrowniclesPacket[] = [];

			await stale.levelUpIfNeeded(staleResponse);

			expect(stale.level).toBe(12);
			expect(levelUpPackets(staleResponse)).toHaveLength(0);
			expect(harness.logs.logLevelChange).toHaveBeenCalledTimes(1);
		});

		it("reports the recipes discovered by the level reached", async () => {
const recipes: RecipeDisplayInfo[] = [{
				recipeId: "potion_health_1", level: 1, recipeType: RecipeType.POTION_HEALTH
			}];
			vi.spyOn(RecipeDiscoveryService, "syncProgressionRecipes").mockResolvedValue(recipes);
			harness.row.level = 11;
			const player = harness.caller();
			const response: CrowniclesPacket[] = [];

			await player.addExperience({
				amount: 338, response, reason: REASON
			});

			expect(levelUpPackets(response)[0].discoveredRecipes).toEqual(recipes);
		});

		it("does not level up the player again while it is already leveling up", async () => {
			vi.spyOn(RecipeDiscoveryService, "syncProgressionRecipes").mockResolvedValue([]);
			harness.row.level = 11;
			harness.row.experience = 400;
			const player = harness.caller();
			const response: CrowniclesPacket[] = [];
			const namespace = getCrowniclesNamespace();

			await namespace.runAndReturn(async () => {
				namespace.set("playersLevelingUp", new Set([PLAYER_ID]));
				await player.levelUpIfNeeded(response);
			});

			expect(player.level).toBe(11);
			expect(levelUpPackets(response)).toHaveLength(0);
		});
	});

	it("does not progress any mission for a null change", async () => {
		const player = harness.caller();
		const response: CrowniclesPacket[] = [];

		await player.addMoney({
			amount: 0, response, reason: REASON
		});
		await player.addExperience({
			amount: 0, response, reason: REASON
		});
		await player.addRage({
			amount: 0, response, reason: REASON
		});
		await player.addTokens({
			amount: 0, response, reason: REASON
		});
		await player.addHealth({
			amount: 0, response, reason: REASON
		});

		expect(harness.missionUpdates).toEqual([]);
	});

	it("levels up in order when a reward of a level up gives experience again", async () => {
		harness.row.level = 9;
		harness.row.experience = 298 + 318;
		const player = harness.caller();
		const response: CrowniclesPacket[] = [];
		vi.spyOn(RecipeDiscoveryService, "syncProgressionRecipes").mockImplementation(async () => {
			// A reward of the level up checks again whether the player levels up
			await player.levelUpIfNeeded(response);
			return [];
		});

		await player.levelUpIfNeeded(response);

		expect(levelUpPackets(response).map(packet => packet.level)).toEqual([10, 11]);
		expect(player.level).toBe(11);
	});

	describe("addLevelUpPacket", () => {
		function packetFor(level: number): Promise<PlayerLevelUpPacket> {
			const player = harness.caller({ level });
			const response: CrowniclesPacket[] = [];
			return player.addLevelUpPacket(response, level, []).then(() => levelUpPackets(response)[0]);
		}

		it("only unlocks the features of the level reached", async () => {
			const packet = await packetFor(3);

			expect(packet).toMatchObject({
				keycloakId: KEYCLOAK_ID,
				level: 3,
				fightUnlocked: false,
				guildUnlocked: false,
				healthRestored: false,
				classesTier1Unlocked: false,
				classesTier2Unlocked: false,
				classesTier3Unlocked: false,
				classesTier4Unlocked: false,
				classesTier5Unlocked: false,
				missionSlotUnlocked: false,
				pveUnlocked: false,
				statsIncreased: true
			});
			expect(packet.discoveredRecipes).toBeUndefined();
		});

		it.each([
			[4, ["classesTier1Unlocked"]],
			[8, ["fightUnlocked"]],
			[16, ["classesTier2Unlocked"]],
			[25, ["missionSlotUnlocked"]],
			[32, ["classesTier3Unlocked"]],
			[48, ["classesTier4Unlocked"]],
			[55, ["missionSlotUnlocked"]],
			[80, ["classesTier5Unlocked", "healthRestored"]]
		])("unlocks at level %i: %s", async (level, unlocked) => {
			const packet = await packetFor(level);

			const unlockedFlags = Object.entries(packet)
				.filter(([key, value]) => key !== "statsIncreased" && value === true)
				.map(([key]) => key);
			expect(unlockedFlags.sort()).toEqual(unlocked);
		});

		it("unlocks the guilds and restores the health at level 10", async () => {
			harness.row.health = 20;
			const packet = await packetFor(10);

			expect(packet.guildUnlocked).toBe(true);
			expect(packet.healthRestored).toBe(true);
			// Class 0 tops at 65 + 10 = 75 health at level 10
			expect(harness.row.health).toBe(75);
			expect(harness.missionUpdates).toEqual([{
				missionId: "earnLifePoints", count: 55, set: false
			}]);
		});

		it("unlocks the PVE island and restores the health at level 20", async () => {
			const packet = await packetFor(20);

			expect(packet.pveUnlocked).toBe(true);
			expect(packet.healthRestored).toBe(true);
		});

		it("does not restore the health of the other levels", async () => {
			harness.row.health = 20;
			await packetFor(21);

			expect(harness.row.health).toBe(20);
			expect(harness.missionUpdates).toEqual([]);
		});
	});

	describe("tokens", () => {
		it("adds tokens up to the cap and reports the actual gain", async () => {
			harness.row.tokens = TokensConstants.MAX - 3;
			const player = harness.caller();

			expect(await player.addTokensAndGetActualGain({
				amount: 5, response: [], reason: REASON
			})).toBe(3);

			expect(player.tokens).toBe(TokensConstants.MAX);
			expect(harness.missionUpdates).toEqual([{
				missionId: "earnTokens", count: 3, set: false
			}, {
				missionId: "maxTokensReached", count: 1, set: true
			}]);
			expect(harness.logs.logTokensChange).toHaveBeenCalledWith(KEYCLOAK_ID, TokensConstants.MAX, REASON);
		});

		it("does not report the cap as reached below it", async () => {
			harness.row.tokens = 2;
			const player = harness.caller();

			expect(await player.addTokensAndGetActualGain({
				amount: 5, response: [], reason: REASON
			})).toBe(5);

			expect(player.tokens).toBe(7);
			expect(harness.missionUpdates[1]).toEqual({
				missionId: "maxTokensReached", count: 0, set: true
			});
		});

		it("grants nothing and logs nothing at the cap", async () => {
			harness.row.tokens = TokensConstants.MAX;
			const player = harness.caller();

			expect(await player.addTokensAndGetActualGain({
				amount: 5, response: [], reason: REASON
			})).toBe(0);

			expect(player.tokens).toBe(TokensConstants.MAX);
			expect(harness.logs.logTokensChange).not.toHaveBeenCalled();
		});

		it("lets a reward exceed the cap when the player was below it", async () => {
			harness.row.tokens = TokensConstants.MAX - 1;
			const player = harness.caller();

			expect(await player.addTokensAndGetActualGain({
				amount: 5, response: [], reason: NumberChangeReason.EXPEDITION
			})).toBe(5);
			expect(player.tokens).toBe(TokensConstants.MAX + 4);

			expect(await player.addTokensAndGetActualGain({
				amount: 5, response: [], reason: NumberChangeReason.KING_CHALLENGE
			})).toBe(0);
		});

		it("pays every reward of an action started below the cap, even once an earlier one reached it", async () => {
			harness.row.tokens = TokensConstants.MAX - 1;
			const player = harness.caller();

			await player.runWithTokenCapReference(async () => {
				await player.addTokens({
					amount: 2, response: [], reason: NumberChangeReason.EXPEDITION
				});
				expect(player.getTokenGain(3, NumberChangeReason.KING_CHALLENGE)).toBe(3);
				expect(player.getTokenGain(3, REASON)).toBe(0);

				// A nested action keeps the reference of the outermost one
				await player.runWithTokenCapReference(() => player.addTokens({
					amount: 3, response: [], reason: NumberChangeReason.BIG_EVENT
				}));
			});

			expect(player.tokens).toBe(TokensConstants.MAX + 4);
			expect(player.getTokenGain(3, NumberChangeReason.BIG_EVENT)).toBe(0);
		});

		it("does not let a reward exceed the cap when the player already reached it", async () => {
			harness.row.tokens = TokensConstants.MAX;
			const player = harness.caller();

			expect(await player.addTokensAndGetActualGain({
				amount: 5, response: [], reason: NumberChangeReason.EXPEDITION
			})).toBe(0);
		});

		it("rejects a null or negative gain", async () => {
			const player = harness.caller();

			await expect(player.addTokensAndGetActualGain({
				amount: 0, response: [], reason: REASON
			})).rejects.toThrow("addTokensAndGetActualGain requires a positive amount");
		});

		it("removes tokens without capping the remaining ones nor progressing a mission, never below 0", async () => {
			harness.row.tokens = TokensConstants.MAX + 6;
			const player = harness.caller();

			expect(await player.addTokens({
				amount: -2, response: [], reason: REASON
			})).toBe(player);

			expect(player.tokens).toBe(TokensConstants.MAX + 4);
			expect(harness.missionUpdates).toEqual([]);
			expect(harness.logs.logTokensChange).toHaveBeenCalledWith(KEYCLOAK_ID, TokensConstants.MAX + 4, REASON);

			await player.addTokens({
				amount: -100, response: [], reason: REASON
			});

			expect(player.tokens).toBe(0);
		});

		it("progresses the earnTokens mission with a positive amount", async () => {
			harness.row.tokens = 1;
			const player = harness.caller();

			await player.addTokens({
				amount: 2, response: [], reason: REASON
			});

			expect(player.tokens).toBe(3);
			expect(harness.missionUpdates[0]).toEqual({
				missionId: "earnTokens", count: 2, set: false
			});
		});

		it("spends tokens, whatever the sign of the amount, and progresses the spendTokens mission", async () => {
			harness.row.tokens = 10;
			const player = harness.caller();

			expect(await player.useTokens({
				amount: -3, response: [], reason: REASON
			})).toBe(player);
			await player.useTokens({
				amount: 20, response: [], reason: REASON
			});

			expect(player.tokens).toBe(0);
			expect(harness.missionUpdates).toEqual([{
				missionId: "spendTokens", count: 3, set: false
			}, {
				missionId: "spendTokens", count: 20, set: false
			}]);
			expect(harness.logs.logTokensChange).toHaveBeenLastCalledWith(KEYCLOAK_ID, 0, REASON);
		});
	});

	describe("rage", () => {
		it("adds rage and progresses the gainRage mission", async () => {
			harness.row.rage = 3;
			const player = harness.caller();

			await player.addRage({
				amount: 2, response: [], reason: REASON
			});

			expect(player.rage).toBe(5);
			expect(harness.missionUpdates).toEqual([{
				missionId: "gainRage", count: 2, set: false
			}]);
			expect(harness.logs.logRageChange).toHaveBeenCalledWith(KEYCLOAK_ID, 5, REASON);
		});

		it("doubles a gain under the amplified rage blessing, the mission counting the base gain", async () => {
			harness.blessings.rageAmplified = true;
			const player = harness.caller();

			await player.addRage({
				amount: 2, response: [], reason: REASON
			});

			expect(player.rage).toBe(4);
			expect(harness.missionUpdates[0].count).toBe(2);
		});

		it("removes rage without the blessing nor a mission", async () => {
			harness.blessings.rageAmplified = true;
			harness.row.rage = 10;
			const player = harness.caller();

			await player.addRage({
				amount: -4, response: [], reason: REASON
			});

			expect(player.rage).toBe(6);
			expect(harness.missionUpdates).toEqual([]);
		});

		it("sets the rage on the locked row", async () => {
			harness.row.rage = 10;
			const player = harness.caller({ rage: 1 });

			await player.setRage(0, REASON);

			expect(player.rage).toBe(0);
			expect(harness.row.rage).toBe(0);
			expect(harness.logs.logRageChange).toHaveBeenCalledWith(KEYCLOAK_ID, 0, REASON);
		});
	});

	describe("setGloryPoints", () => {
		it("sets the defense glory, keeping the attack glory of the locked row in the reachGlory mission", async () => {
			harness.row.attackGloryPoints = 300;
			harness.row.defenseGloryPoints = 100;
			const player = harness.caller({ attackGloryPoints: 0 });

			await player.setGloryPoints(250, true, REASON, [], 12);

			expect(player.defenseGloryPoints).toBe(250);
			expect(player.attackGloryPoints).toBe(300);
			expect(player.getGloryPoints()).toBe(550);
			expect(harness.missionUpdates).toEqual([{
				missionId: "reachGlory", count: 550, set: true
			}]);
			expect(harness.logs.logPlayersDefenseGloryPoints).toHaveBeenCalledWith(KEYCLOAK_ID, 250, REASON, 12);
			expect(harness.logs.logPlayersAttackGloryPoints).not.toHaveBeenCalled();
		});

		it("sets the attack glory", async () => {
			harness.row.defenseGloryPoints = 100;
			const player = harness.caller();

			await player.setGloryPoints(400, false, REASON, []);

			expect(player.attackGloryPoints).toBe(400);
			expect(player.defenseGloryPoints).toBe(100);
			expect(harness.logs.logPlayersAttackGloryPoints).toHaveBeenCalledWith(KEYCLOAK_ID, 400, REASON, undefined);
			expect(harness.logs.logPlayersDefenseGloryPoints).not.toHaveBeenCalled();
		});
	});

	describe("health", () => {
		it("counts the overheal in the earnLifePoints mission by default", async () => {
			harness.row.health = 70;
			const player = harness.caller();

			await player.addHealth({
				amount: 20, response: [], reason: REASON
			});

			// Class 0 tops at 75 health at level 10
			expect(player.getHealthValue()).toBe(75);
			expect(harness.missionUpdates).toEqual([{
				missionId: "earnLifePoints", count: 20, set: false
			}]);
			expect(harness.logs.logHealthChange).toHaveBeenCalledWith(KEYCLOAK_ID, 75, REASON);
		});

		it("only counts the health actually restored when the overheal does not count", async () => {
			harness.row.health = 70;
			const player = harness.caller();

			await player.addHealth({
				amount: 20,
				response: [],
				reason: REASON,
				missionHealthParameter: {
					shouldPokeMission: true, overHealCountsForMission: false
				}
			});

			expect(harness.missionUpdates[0].count).toBe(5);
		});

		it("counts the whole heal when the overheal does not count but the heal stays below the maximum", async () => {
			harness.row.health = 10;
			const player = harness.caller();

			await player.addHealth({
				amount: 20,
				response: [],
				reason: REASON,
				missionHealthParameter: {
					shouldPokeMission: true, overHealCountsForMission: false
				}
			});

			expect(player.getHealthValue()).toBe(30);
			expect(harness.missionUpdates[0].count).toBe(20);
		});

		it("does not progress the mission when asked not to", async () => {
			harness.row.health = 10;
			const player = harness.caller();

			await player.addHealth({
				amount: 20,
				response: [],
				reason: REASON,
				missionHealthParameter: {
					shouldPokeMission: false, overHealCountsForMission: true
				}
			});

			expect(player.getHealthValue()).toBe(30);
			expect(harness.missionUpdates).toEqual([]);
		});

		it("heals from the locked health", async () => {
			harness.row.health = 40;
			const player = harness.caller({ health: 10 });

			await player.addHealth({
				amount: 5, response: [], reason: REASON
			});

			expect(player.getHealthValue()).toBe(45);
			expect(harness.missionUpdates[0].count).toBe(5);
		});

		it("heals from the capped health of a player above its maximum", async () => {
			harness.row.health = 500;
			const player = harness.caller();

			await player.addHealth({
				amount: 5, response: [], reason: REASON
			});

			expect(player.getHealthValue()).toBe(75);
			expect(harness.missionUpdates[0].count).toBe(5);
		});
	});

	describe("leavePVEIslandIfNoEnergy", () => {
		// An unknown class has a max energy of 100
		const UNKNOWN_CLASS = 999;

		const noEnchantmentActiveObjects = {
			weapon: { itemEnchantmentId: null },
			armor: { itemEnchantmentId: null }
		} as PlayerActiveObjects;

		let guild: { score: number; addScore: ReturnType<typeof vi.fn>; save: ReturnType<typeof vi.fn> } | null;

		beforeEach(() => {
			guild = null;
			harness.row.class = UNKNOWN_CLASS;
			harness.row.fightPointsLost = 100;
			harness.row.level = 10;
			harness.row.money = 500;
			vi.spyOn(Maps, "isOnPveIsland").mockReturnValue(true);
			vi.spyOn(Maps, "stopTravel").mockResolvedValue(undefined);
			vi.spyOn(Maps, "startTravel").mockResolvedValue(undefined);
			vi.spyOn(TravelTime, "applyEffect").mockResolvedValue(undefined);
			vi.spyOn(PlayerSmallEvents, "removeSmallEventsOfPlayer").mockResolvedValue(undefined);
			vi.spyOn(RandomUtils, "randInt").mockReturnValue(1);
			vi.spyOn(RandomUtils.crowniclesRandom, "integer").mockReturnValue(5);
			// Only the score of the guild and its update are used by the PVE island faint
			vi.spyOn(Guilds, "getById").mockImplementation(() => Promise.resolve(guild as unknown as Guild));
		});

		function leavePackets(response: CrowniclesPacket[]): PlayerLeavePveIslandPacket[] {
			return response.filter((packet): packet is PlayerLeavePveIslandPacket => packet instanceof PlayerLeavePveIslandPacket);
		}

		it("stays on the island while the player has energy", async () => {
			harness.row.fightPointsLost = 99;
			const response: CrowniclesPacket[] = [];

			expect(await harness.caller().leavePVEIslandIfNoEnergy(response, noEnchantmentActiveObjects)).toBe(false);

			expect(response).toEqual([]);
			expect(Maps.stopTravel).not.toHaveBeenCalled();
		});

		it("does nothing outside of the island", async () => {
			vi.mocked(Maps.isOnPveIsland).mockReturnValue(false);

			expect(await harness.caller().leavePVEIslandIfNoEnergy([], noEnchantmentActiveObjects)).toBe(false);
			expect(harness.row.money).toBe(500);
		});

		it("sends a solo player without energy back to the sea, confounded, with the solo money malus", async () => {
			const player = harness.caller();
			const response: CrowniclesPacket[] = [];

			expect(await player.leavePVEIslandIfNoEnergy(response, noEnchantmentActiveObjects)).toBe(true);

			// 10 levels * 3.4 * 2 for a solo player
			expect(harness.row.money).toBe(500 - 68);
			expect(leavePackets(response)).toEqual([expect.objectContaining({
				moneyLost: 68, guildPointsLost: 0
			})]);
			expect(Maps.stopTravel).toHaveBeenCalledWith(player);
			expect(RandomUtils.randInt).toHaveBeenCalledWith(0, MapConstants.WATER_MAP_LINKS.length);
			expect(Maps.startTravel).toHaveBeenCalledWith(player, MapLinkDataController.instance.getById(MapConstants.WATER_MAP_LINKS[1]), expect.any(Number));
			expect(TravelTime.applyEffect).toHaveBeenCalledWith(player, Effect.CONFOUNDED, 0, expect.any(Date), NumberChangeReason.PVE_ISLAND);
			expect(PlayerSmallEvents.removeSmallEventsOfPlayer).toHaveBeenCalledWith(PLAYER_ID);
			expect(Guilds.getById).not.toHaveBeenCalled();
		});

		it("never takes more money than the player owns", async () => {
			harness.row.money = 20;
			const response: CrowniclesPacket[] = [];

			await harness.caller().leavePVEIslandIfNoEnergy(response, noEnchantmentActiveObjects);

			expect(harness.row.money).toBe(0);
			expect(leavePackets(response)[0].moneyLost).toBe(20);
		});

		it("takes the guild money malus and guild points from a player in a guild", async () => {
			harness.row.guildId = 3;
			guild = {
				score: 1000, addScore: vi.fn().mockResolvedValue(undefined), save: vi.fn().mockResolvedValue(undefined)
			};
			const response: CrowniclesPacket[] = [];

			await harness.caller().leavePVEIslandIfNoEnergy(response, noEnchantmentActiveObjects);

			expect(harness.row.money).toBe(500 - 34);
			expect(RandomUtils.crowniclesRandom.integer).toHaveBeenCalledWith(-20, 20);
			expect(Guilds.getById).toHaveBeenCalledWith(3);
			expect(guild.addScore).toHaveBeenCalledWith({
				amount: -155, response, reason: NumberChangeReason.PVE_ISLAND
			});
			expect(guild.save).toHaveBeenCalled();
			expect(leavePackets(response)[0]).toMatchObject({
				moneyLost: 34, guildPointsLost: 155
			});
		});

		it("never takes more guild points than the guild owns", async () => {
			harness.row.guildId = 3;
			guild = {
				score: 100, addScore: vi.fn().mockResolvedValue(undefined), save: vi.fn().mockResolvedValue(undefined)
			};
			const response: CrowniclesPacket[] = [];

			await harness.caller().leavePVEIslandIfNoEnergy(response, noEnchantmentActiveObjects);

			expect(guild.addScore).toHaveBeenCalledWith(expect.objectContaining({ amount: -100 }));
			expect(leavePackets(response)[0].guildPointsLost).toBe(100);
		});

		it("only takes money from a player whose guild no longer exists", async () => {
			harness.row.guildId = 3;
			const response: CrowniclesPacket[] = [];

			expect(await harness.caller().leavePVEIslandIfNoEnergy(response, noEnchantmentActiveObjects)).toBe(true);

			expect(harness.row.money).toBe(500 - 34);
		});

		it("does not start a travel when the drawn water link is unknown", async () => {
			vi.spyOn(MapLinkDataController.instance, "getById").mockReturnValue(undefined);

			expect(await harness.caller().leavePVEIslandIfNoEnergy([], noEnchantmentActiveObjects)).toBe(true);

			expect(Maps.startTravel).not.toHaveBeenCalled();
		});
	});
});
