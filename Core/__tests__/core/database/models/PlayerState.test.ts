import {
	afterEach, describe, expect, it, vi
} from "vitest";
import Player, { Players } from "../../../../src/core/database/game/models/Player";
import MissionSlot from "../../../../src/core/database/game/models/MissionSlot";
import { PlayerActiveObjects } from "../../../../src/core/database/game/models/PlayerActiveObjects";
import PetEntity from "../../../../src/core/database/game/models/PetEntity";
import { LogsReadRequests } from "../../../../src/core/database/logs/LogsReadRequests";
import { LeagueDataController } from "../../../../src/data/League";
import { MapLocationDataController } from "../../../../src/data/MapLocation";
import { setCrowniclesInstanceForTests } from "../../../../src/app";
import { Effect } from "../../../../../Lib/src/types/Effect";
import { NumberChangeReason } from "../../../../../Lib/src/constants/LogsConstants";
import { ClassConstants } from "../../../../../Lib/src/constants/ClassConstants";
import { ClassInfoConstants } from "../../../../../Lib/src/constants/ClassInfoConstants";
import { PVEConstants } from "../../../../../Lib/src/constants/PVEConstants";
import { PlayersConstants } from "../../../../../Lib/src/constants/PlayersConstants";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";
import { PetConstants } from "../../../../../Lib/src/constants/PetConstants";
import {
	buildPlayer, KEYCLOAK_ID, PLAYER_ID, useLogsDatabase
} from "./PlayerRowFixture";

const NOW = Date.UTC(2026, 10, 21, 12);

const HOUR_MS = 60 * 60 * 1000;

const UNKNOWN_CLASS = 999;

/**
 * Active objects without any enchantment
 */
const noEnchantmentActiveObjects = {
	weapon: { itemEnchantmentId: null },
	armor: { itemEnchantmentId: null }
} as PlayerActiveObjects;

function missionSlot(expiresAt: Date | null): MissionSlot {
	return Object.assign(Object.create(MissionSlot.prototype) as MissionSlot, { expiresAt });
}

describe("Player state", () => {
	afterEach(() => {
		setCrowniclesInstanceForTests(null);
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	describe("experience", () => {
		it.each([
			[1, 164],
			[9, 298],
			[10, 318],
			[25, 736]
		])("needs, at level %i, %i experience to level up", (level, experience) => {
			expect(buildPlayer({ level }).getExperienceNeededToLevelUp()).toBe(experience);
		});

		it("needs to level up once the experience reaches the next level", () => {
			expect(buildPlayer({
				level: 10, experience: 317
			}).needLevelUp()).toBe(false);
			expect(buildPlayer({
				level: 10, experience: 318
			}).needLevelUp()).toBe(true);
		});
	});

	describe("mission slots", () => {
		it.each([
			[1, 1],
			[24, 1],
			[25, 2],
			[54, 2],
			[55, 3],
			[120, 3]
		])("has at level %i %i secondary mission slots", (level, slots) => {
			expect(buildPlayer({ level }).getMissionSlotsNumber()).toBe(slots);
		});

		it("unlocks a mission slot at the levels 25 and 55 only", () => {
			const unlockingLevels = Array.from({ length: 120 }, (_, level) => level)
				.filter(level => Player.isMissionSlotUnlockedAtLevel(level));

			expect(unlockingLevels).toEqual([25, 55]);
		});

		it("has an empty slot while its secondary missions do not fill its slots, the campaign aside", () => {
			const player = buildPlayer({ level: 25 });
			const secondary = missionSlot(new Date(NOW + HOUR_MS));
			const campaign = missionSlot(null);

			expect(player.hasEmptyMissionSlot([campaign, secondary])).toBe(true);
			expect(player.hasEmptyMissionSlot([campaign, secondary, secondary])).toBe(false);
		});
	});

	describe("effects", () => {
		function playerUnder(effect: Effect, effectEndDate: Date | null): ReturnType<typeof buildPlayer> {
			return buildPlayer({
				effectId: effect.id, effectEndDate
			});
		}

		it("never ends the dead and not started effects", () => {
			const past = new Date(NOW - HOUR_MS);

			expect(playerUnder(Effect.DEAD, past).currentEffectFinished(new Date(NOW))).toBe(false);
			expect(playerUnder(Effect.NOT_STARTED, past).currentEffectFinished(new Date(NOW))).toBe(false);
		});

		it("has finished the no effect and an effect without end date", () => {
			const future = new Date(NOW + HOUR_MS);

			expect(playerUnder(Effect.NO_EFFECT, future).currentEffectFinished(new Date(NOW))).toBe(true);
			expect(playerUnder(Effect.SICK, null).currentEffectFinished(new Date(NOW))).toBe(true);
		});

		it("finishes an effect once its end date is past", () => {
			const player = playerUnder(Effect.SICK, new Date(NOW));

			expect(player.currentEffectFinished(new Date(NOW))).toBe(false);
			expect(player.currentEffectFinished(new Date(NOW + 1))).toBe(true);
		});

		it("gives the time remaining before the end of the effect, never negative", () => {
			vi.spyOn(Date, "now").mockReturnValue(NOW);

			expect(playerUnder(Effect.SICK, new Date(NOW + HOUR_MS)).effectRemainingTime()).toBe(HOUR_MS);
			expect(playerUnder(Effect.SICK, new Date(NOW - HOUR_MS)).effectRemainingTime()).toBe(0);
			expect(playerUnder(Effect.SICK, null).effectRemainingTime()).toBe(0);
			expect(playerUnder(Effect.SICK, new Date(0)).effectRemainingTime()).toBe(0);
		});

		it("gives no remaining time for an unknown effect", () => {
			vi.spyOn(Date, "now").mockReturnValue(NOW);

			expect(buildPlayer({
				effectId: "unknownEffect", effectEndDate: new Date(NOW + HOUR_MS)
			}).effectRemainingTime()).toBe(0);
		});

		it("is under an effect for every effect but none, dead and not started", () => {
			expect(playerUnder(Effect.SICK, null).isUnderEffect()).toBe(true);
			expect(playerUnder(Effect.OCCUPIED, null).isUnderEffect()).toBe(true);
			expect(playerUnder(Effect.NO_EFFECT, null).isUnderEffect()).toBe(false);
			expect(playerUnder(Effect.DEAD, null).isUnderEffect()).toBe(false);
			expect(playerUnder(Effect.NOT_STARTED, null).isUnderEffect()).toBe(false);
		});

		it("is dead under the dead effect only", () => {
			expect(playerUnder(Effect.DEAD, null).isDead()).toBe(true);
			expect(playerUnder(Effect.SICK, null).isDead()).toBe(false);
		});

		it("has started to play once out of the not started effect", () => {
			expect(playerUnder(Effect.NOT_STARTED, null).hasStartedToPlay()).toBe(false);
			expect(playerUnder(Effect.NO_EFFECT, null).hasStartedToPlay()).toBe(true);
		});
	});

	describe("activity", () => {
		it("has a guild once it joined one", () => {
			expect(buildPlayer({ guildId: null }).hasAGuild()).toBe(false);
			expect(buildPlayer({ guildId: 3 }).hasAGuild()).toBe(true);
		});

		it("cannot be joined in the boat once it travels for longer than allowed", () => {
			vi.spyOn(Date, "now").mockReturnValue(NOW);
			const limit = NOW - PVEConstants.TIME_AFTER_INACTIVITY_ON_BOAT_IS_NOT_ACCEPTED;

			expect(buildPlayer({ startTravelDate: new Date(limit) }).isNotActiveEnoughToBeJoinedInTheBoat()).toBe(false);
			expect(buildPlayer({ startTravelDate: new Date(limit - 1) }).isNotActiveEnoughToBeJoinedInTheBoat()).toBe(true);
		});

		it("pays a travel to the PVE island more for each travel this week, up to the last cost", async () => {
			const countSpy = vi.spyOn(LogsReadRequests, "getCountPVEIslandThisWeek");
			const player = buildPlayer({ guildId: 4 });
			const costs: number[] = [];
			for (const count of [0, 1, 2, 3, 10]) {
				countSpy.mockResolvedValueOnce(count);
				costs.push(await player.getTravelCostThisWeek());
			}

			expect(costs).toEqual([0, 15, 25, 25, 25]);
			expect(countSpy).toHaveBeenCalledWith(KEYCLOAK_ID, 4);
		});
	});

	describe("meals", () => {
		it("can eat without a previous meal, and again once the cooldown is over", () => {
			vi.spyOn(Date, "now").mockReturnValue(NOW);

			expect(buildPlayer({ lastMealAt: null }).canEat()).toBe(true);
			expect(buildPlayer({ lastMealAt: new Date(NOW - PlayersConstants.MEAL_COOLDOWN) }).canEat()).toBe(false);
			expect(buildPlayer({ lastMealAt: new Date(NOW - PlayersConstants.MEAL_COOLDOWN - 1) }).canEat()).toBe(true);
		});

		it("gives the time the next meal is available at", () => {
			vi.spyOn(Date, "now").mockReturnValue(NOW);

			expect(buildPlayer({ lastMealAt: null }).nextMealAvailableAt()).toBe(NOW);
			expect(buildPlayer({ lastMealAt: new Date(NOW - HOUR_MS) }).nextMealAvailableAt()).toBe(NOW - HOUR_MS + PlayersConstants.MEAL_COOLDOWN);
		});

		it("cannot eat again right after a meal", () => {
			vi.useFakeTimers({ now: NOW });
			const player = buildPlayer({ lastMealAt: null });

			player.eatMeal();

			expect(player.lastMealAt.valueOf()).toBe(NOW);
			expect(player.canEat()).toBe(false);
		});
	});

	describe("league", () => {
		it("has no profile color before the fights are unlocked", () => {
			expect(buildPlayer({ level: FightConstants.REQUIRED_LEVEL - 1 }).getProfileColor()).toBeNull();
		});

		it("takes the color of the league of its glory, attack and defense summed", () => {
			const player = buildPlayer({
				level: FightConstants.REQUIRED_LEVEL,
				attackGloryPoints: 200,
				defenseGloryPoints: 150
			});

			expect(player.getLeague()).toBe(LeagueDataController.instance.getByGlory(350));
			expect(player.getProfileColor()).toBe(LeagueDataController.instance.getByGlory(350).color);
			expect(player.getLeague()).not.toBe(LeagueDataController.instance.getByGlory(200));
		});

		it("gives the league of the glory of the last season", () => {
			expect(buildPlayer({ gloryPointsLastSeason: 350 }).getLeagueLastSeason()).toBe(LeagueDataController.instance.getByGlory(350));
		});

		it.each([
			[500, 0],
			[1, 3000],
			[2, 2730],
			[10, 2200],
			[200, 10],
			[201, 0]
		])("awards at the rank %i %i points at the end of the season", async (rank, points) => {
			const rankSpy = vi.spyOn(Players, "getLastSeasonGloryRankById").mockResolvedValue(rank);

			expect(await buildPlayer().getLastSeasonScoreToAward()).toBe(points);
			expect(rankSpy).toHaveBeenCalledWith(PLAYER_ID);
		});

		it("has claimed the league reward when it was given less than a day ago", async () => {
			vi.useFakeTimers({ now: NOW });
			const lastReward = vi.spyOn(LogsReadRequests, "getDateOfLastLeagueReward");
			const player = buildPlayer();
			const nowInSeconds = NOW / 1000;

			lastReward.mockResolvedValueOnce(null);
			expect(await player.hasClaimedLeagueReward()).toBe(false);
			lastReward.mockResolvedValueOnce(nowInSeconds - 60);
			expect(await player.hasClaimedLeagueReward()).toBe(true);
			lastReward.mockResolvedValueOnce(nowInSeconds - 24 * 3600);
			expect(await player.hasClaimedLeagueReward()).toBe(true);
			lastReward.mockResolvedValueOnce(nowInSeconds - 24 * 3600 - 1);
			expect(await player.hasClaimedLeagueReward()).toBe(false);
			expect(lastReward).toHaveBeenCalledWith(KEYCLOAK_ID);
		});

		it("keeps its own rating against the guards once it fought one", () => {
			expect(buildPlayer({ guardGloryPoints: 1234 }).getGuardGloryPoints()).toBe(1234);
		});
	});

	describe("defense personality", () => {
		it("forgets a personality its class does not offer", () => {
			const player = buildPlayer({ defensePersonality: "aggressive" });

			expect(player.forgetDefensePersonalityNotIn(["defensive"] as never[])).toBe("aggressive");
			expect(player.defensePersonality).toBeNull();
		});

		it("keeps a personality its class offers, or no personality", () => {
			const player = buildPlayer({ defensePersonality: "aggressive" });

			expect(player.forgetDefensePersonalityNotIn(["aggressive"] as never[])).toBeUndefined();
			expect(player.defensePersonality).toBe("aggressive");
			expect(buildPlayer({ defensePersonality: null }).forgetDefensePersonalityNotIn([])).toBeUndefined();
		});
	});

	describe("holy classes", () => {
		it("does not give a holy class to the classes beyond the first five ids", () => {
			expect(buildPlayer({ class: ClassConstants.CLASSES_ID.HELMETED }).hasHolyClass()).toBe(false);
			expect(buildPlayer({ class: ClassConstants.CLASSES_ID.MYSTIC_MAGE }).hasHolyClass()).toBe(false);
		});

		it("gives a holy class to every class of the holy lineage", () => {
			for (const holyClass of ClassInfoConstants.HOLY_CLASSES) {
				expect(buildPlayer({ class: holyClass }).hasHolyClass()).toBe(true);
			}
		});

		it("does not give a holy class to the classes whose id is an index of the holy classes", () => {
			for (const index of ClassInfoConstants.HOLY_CLASSES.keys()) {
				expect(buildPlayer({ class: index }).hasHolyClass()).toBe(false);
			}
		});
	});

	describe("energy", () => {
		// Class 0 tops at 351 cumulative energy at level 9
		const MAX_ENERGY = 351;

		function playerWithLostEnergy(fightPointsLost: number): ReturnType<typeof buildPlayer> {
			return buildPlayer({
				level: 9, class: 0, fightPointsLost
			});
		}

		it("has its max energy minus the energy lost, within 0 and its max", () => {
			expect(playerWithLostEnergy(51).getCumulativeEnergy(noEnchantmentActiveObjects)).toBe(MAX_ENERGY - 51);
			expect(playerWithLostEnergy(-10).getCumulativeEnergy(noEnchantmentActiveObjects)).toBe(MAX_ENERGY);
			expect(playerWithLostEnergy(1000).getCumulativeEnergy(noEnchantmentActiveObjects)).toBe(0);
		});

		it("gives the ratio of its energy", () => {
			expect(playerWithLostEnergy(0).getRatioCumulativeEnergy(noEnchantmentActiveObjects)).toBe(1);
			expect(playerWithLostEnergy(MAX_ENERGY).getRatioCumulativeEnergy(noEnchantmentActiveObjects)).toBe(0);
		});

		it("has enough energy to fight at exactly the minimal ratio", () => {
			// An unknown class has a max energy of 100
			const lostEnergy = 100 * (1 - PVEConstants.MINIMAL_ENERGY_RATIO);

			expect(buildPlayer({
				class: UNKNOWN_CLASS, fightPointsLost: lostEnergy
			}).hasEnoughEnergyToFight(noEnchantmentActiveObjects)).toBe(true);
		});

		it("has enough energy to fight from the minimal ratio", () => {
			const minimalEnergy = Math.ceil(MAX_ENERGY * PVEConstants.MINIMAL_ENERGY_RATIO);

			expect(playerWithLostEnergy(MAX_ENERGY - minimalEnergy).hasEnoughEnergyToFight(noEnchantmentActiveObjects)).toBe(true);
			expect(playerWithLostEnergy(MAX_ENERGY - minimalEnergy + 1).hasEnoughEnergyToFight(noEnchantmentActiveObjects)).toBe(false);
		});

		it("regains energy, never above its max, and logs the energy lost left", () => {
			const logEnergyChange = vi.fn().mockResolvedValue(undefined);
			useLogsDatabase({ logEnergyChange });
			const player = playerWithLostEnergy(100);

			player.addEnergy(30, NumberChangeReason.TEST, noEnchantmentActiveObjects);

			expect(player.fightPointsLost).toBe(70);
			expect(logEnergyChange).toHaveBeenCalledWith(KEYCLOAK_ID, 70, NumberChangeReason.TEST);

			player.addEnergy(500, NumberChangeReason.TEST, noEnchantmentActiveObjects);

			expect(player.fightPointsLost).toBe(0);
		});

		it("never loses more energy than its max", () => {
			useLogsDatabase({ logEnergyChange: vi.fn().mockResolvedValue(undefined) });
			const player = playerWithLostEnergy(0);

			player.setEnergyLost(1000, NumberChangeReason.TEST, noEnchantmentActiveObjects);

			expect(player.fightPointsLost).toBe(MAX_ENERGY);
		});

		it("uses the default energy, health and stats of an unknown class", () => {
			const player = buildPlayer({ class: UNKNOWN_CLASS });

			expect(player.getMaxCumulativeEnergy(noEnchantmentActiveObjects)).toBe(FightConstants.PLAYER_MAX_ENERGY);
			expect(player.getMaxHealth()).toBe(100);
			expect(player.getMaxStatsValue()).toEqual({
				attack: 0, defense: 0, speed: 0
			});
		});
	});

	describe("breath", () => {
		it("takes the breath of its class", () => {
			const player = buildPlayer({ class: 3 });

			expect(player.getBaseBreath()).toBe(6);
			expect(player.getMaxBreath()).toBe(14);
			expect(buildPlayer({ class: 4 }).getBreathRegen()).toBe(3);
		});

		it("uses the default breath of an unknown class", () => {
			const player = buildPlayer({ class: UNKNOWN_CLASS });

			expect(player.getBaseBreath()).toBe(FightConstants.DEFAULT_BASE_BREATH);
			expect(player.getMaxBreath()).toBe(FightConstants.DEFAULT_MAX_BREATH);
			expect(player.getBreathRegen()).toBe(FightConstants.DEFAULT_BREATH_REGEN);
		});
	});

	describe("travel", () => {
		it("reads its origin, destination and trip duration from its map link", () => {
			// Link 1 goes from the map 1 to the map 26 in 60 minutes
			const player = buildPlayer({ mapLinkId: 1 });

			expect(player.getPreviousMapId()).toBe(1);
			expect(player.getDestinationId()).toBe(26);
			expect(player.getPreviousMap()).toBe(MapLocationDataController.instance.getById(1));
			expect(player.getDestination()).toBe(MapLocationDataController.instance.getById(26));
			expect(player.getCurrentTripDuration()).toBe(1);
		});

		it("knows the city it travels to", () => {
			// Link 4 leads to the map 6, a city, link 2 to the map 1, a beach
			expect(buildPlayer({ mapLinkId: 4 }).getCurrentCityId()).toBe("boug_coton");
			expect(buildPlayer({ mapLinkId: 2 }).getCurrentCityId()).toBeNull();
		});

		it("has no origin nor destination without a known map link", () => {
			const player = buildPlayer({ mapLinkId: -1 });

			expect(player.getPreviousMapId()).toBeNull();
			expect(player.getDestinationId()).toBeNull();
			expect(player.getPreviousMap()).toBeNull();
			expect(player.getDestination()).toBeNull();
			expect(player.getCurrentTripDuration()).toBeNull();
			expect(player.getCurrentCityId()).toBeNull();
		});
	});

	describe("locks", () => {
		it("locks the row of its id", () => {
			expect(Player.lockKey(PLAYER_ID)).toEqual({
				model: Player, id: PLAYER_ID
			});
		});
	});

	describe("death", () => {
		it("does not kill a player with health left", async () => {
			const response: never[] = [];

			expect(await buildPlayer({ health: 1 }).killIfNeeded(response, NumberChangeReason.TEST)).toBe(false);
			expect(response).toEqual([]);
		});
	});

	describe("pets", () => {
		it("adopts a pet and logs it", () => {
			const logPlayerNewPet = vi.fn().mockResolvedValue(undefined);
			useLogsDatabase({ logPlayerNewPet });
			const player = buildPlayer({ petId: null });
			// Only the id of the pet is kept by the player
			const pet = { id: 31, sex: PetConstants.SEX.MALE } as unknown as PetEntity;

			player.setPet(pet);

			expect(player.petId).toBe(31);
			expect(logPlayerNewPet).toHaveBeenCalledWith(KEYCLOAK_ID, pet);
		});
	});

	describe("health", () => {
		it("caps the health to its maximum, and sets it without check", () => {
			const player = buildPlayer({
				level: 10, class: 0, health: 10
			});

			player.setHealthNoCheck(500);

			expect(player.getHealthValue()).toBe(500);
			expect(player.getHealth()).toBe(75);
		});
	});
});
