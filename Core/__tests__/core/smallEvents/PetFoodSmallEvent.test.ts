import {
	beforeEach, describe, expect, it, vi
} from "vitest";
import { smallEventFuncs } from "../../../src/core/smallEvents/petFood";
import { PetEntity } from "../../../src/core/database/game/models/PetEntity";
import { PetUtils } from "../../../src/core/utils/PetUtils";
import { Maps } from "../../../src/core/maps/Maps";
import { TravelTime } from "../../../src/core/maps/TravelTime";
import { MapLinkDataController } from "../../../src/data/MapLink";
import {
	MapLocation, MapLocationDataController
} from "../../../src/data/MapLocation";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { SmallEventConstants } from "../../../../Lib/src/constants/SmallEventConstants";
import { PetConstants } from "../../../../Lib/src/constants/PetConstants";
import { MapConstants } from "../../../../Lib/src/constants/MapConstants";
import { MapLocationConstants } from "../../../../Lib/src/constants/MapLocationConstants";
import { ExpeditionConstants } from "../../../../Lib/src/constants/ExpeditionConstants";
import { Effect } from "../../../../Lib/src/types/Effect";
import {
	ReactionCollectorPetFoodContinueReaction,
	ReactionCollectorPetFoodInvestigateReaction,
	ReactionCollectorPetFoodSendPetReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorPetFoodSmallEvent";
import { SmallEventPetFoodPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventPetFoodPacket";
import { CrowniclesPacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	asPlayer, createTestPlayer, endWithoutReaction, ignoresOtherPlayers, isBlocked, packetOf, reactWith, runSmallEvent, SmallEventRun, TEST_NOW, TestPlayer, useSmallEventHarness
} from "./SmallEventHarness";

vi.mock("../../../src/core/utils/withLockedPlayerSafe", async () => ({
	withLockedPlayerSafe: (await import("./SmallEventHarness")).lockedPlayerPassthrough
}));

const OUTCOMES = SmallEventConstants.PET_FOOD.OUTCOMES;
const FOOD = SmallEventConstants.PET_FOOD.FOOD_TYPES;
const HOUR = 3_600_000;

// Pets of resources/pets: their diet, force and feed delay matter
const CARNIVOROUS_PET = 1;
const HERBIVOROUS_PET = 10;
const OMNIVOROUS_PET = 29;

// The carnivorous pet is hungry 1.5 h after being fed, and starts to weaken after 4.5 h
const CARNIVOROUS_FEED_DELAY = 1.5 * HOUR;

// resources/smallEvents/petFood.json
const LOVE = {
	badSmell: -1, goodSmell: 1, vegetarian: 3, meat: 3, soup: 5
};

type TestPetEntity = {
	typeId: number;
	lovePoints: number;
	hungrySince: Date | null;
	sex: string;
	save: ReturnType<typeof vi.fn>;
};

function mockPetEntity(overrides: Partial<TestPetEntity> = {}): TestPetEntity {
	const petEntity: TestPetEntity = {
		typeId: OMNIVOROUS_PET,
		lovePoints: 50,
		hungrySince: null,
		sex: "f",
		save: vi.fn().mockResolvedValue(undefined),
		...overrides
	};
	vi.spyOn(PetEntity, "findByPk").mockResolvedValue(petEntity as never);
	return petEntity;
}

function mockRolls(...rolls: number[]): void {
	const realZeroToOneInclusive = vi.spyOn(RandomUtils.crowniclesRandom, "realZeroToOneInclusive");
	for (const roll of rolls) {
		realZeroToOneInclusive.mockReturnValueOnce(roll);
	}
}

/**
 * The Road of Wonders always smells of soup, without drawing the food
 */
function onRoadOfWonders(): void {
	vi.spyOn(MapLinkDataController.instance, "getById").mockReturnValue({
		id: 1, startMap: MapConstants.LOCATIONS_IDS.ROAD_OF_WONDERS, endMap: 2
	} as never);
	vi.spyOn(MapLocationDataController.instance, "getById").mockImplementation(mapId => Object.assign(new MapLocation(), {
		id: mapId, type: MapLocationConstants.TYPES.ROAD, biomes: [ExpeditionConstants.EXPEDITION_LOCATION_TYPES.DESERT]
	}));
}

/**
 * In the desert, the food draw gives a bad smell below 0.6, vegetarian food below 0.8, meat below 0.9 and a good smell above
 */
function inDesert(): void {
	vi.spyOn(MapLinkDataController.instance, "getById").mockReturnValue({
		id: 1, startMap: 3, endMap: 4
	} as never);
	vi.spyOn(MapLocationDataController.instance, "getById").mockImplementation(mapId => Object.assign(new MapLocation(), {
		id: mapId, type: MapLocationConstants.TYPES.ROAD, biomes: [ExpeditionConstants.EXPEDITION_LOCATION_TYPES.DESERT]
	}));
	vi.spyOn(TravelTime, "getTravelProgress").mockReturnValue(0.5);
}

async function findFood(player: TestPlayer, foodRoll?: number): Promise<SmallEventRun> {
	if (foodRoll !== undefined) {
		mockRolls(0, foodRoll);
	}
	return await runSmallEvent(smallEventFuncs, player);
}

describe("pet food small event", () => {
	useSmallEventHarness();
	let applyEffect: ReturnType<typeof vi.spyOn>;
	let player: TestPlayer;

	beforeEach(() => {
		applyEffect = vi.spyOn(TravelTime, "applyEffect").mockResolvedValue();
		player = createTestPlayer({ petId: 7 });
		onRoadOfWonders();
	});

	describe("availability", () => {
		function canBeExecuted(): Promise<boolean> {
			return Promise.resolve(smallEventFuncs.canBeExecuted(asPlayer(player), {} as never));
		}

		beforeEach(() => {
			vi.spyOn(Maps, "isOnContinent").mockReturnValue(true);
			vi.spyOn(PetUtils, "isPetAvailable").mockResolvedValue(true);
			mockPetEntity({ lovePoints: PetConstants.MAX_LOVE_POINTS - 1 });
		});

		it("happens on the continent to a player whose available pet can love them more", async () => {
			expect(await canBeExecuted()).toBe(true);
		});

		it("does not happen outside the continent", async () => {
			vi.spyOn(Maps, "isOnContinent").mockReturnValue(false);
			expect(await canBeExecuted()).toBe(false);
		});

		it("does not happen to a player without pet, or whose pet is not available", async () => {
			player.petId = null;
			expect(await canBeExecuted()).toBe(false);

			player.petId = 7;
			vi.spyOn(PetUtils, "isPetAvailable").mockResolvedValue(false);
			expect(await canBeExecuted()).toBe(false);
		});

		it("does not happen when the pet cannot be loaded", async () => {
			vi.spyOn(PetEntity, "findByPk").mockResolvedValue(null);
			expect(await canBeExecuted()).toBe(false);
		});

		it("does not happen when the pet already loves the player at most", async () => {
			mockPetEntity({ lovePoints: PetConstants.MAX_LOVE_POINTS });
			expect(await canBeExecuted()).toBe(false);
		});
	});

	it("offers the player only to investigate, send their pet or continue, and blocks them meanwhile", async () => {
		mockPetEntity({ sex: "m" });

		const run = await findFood(player);

		expect(run.collector?.creationPacket.reactions.map(reaction => reaction.type)).toEqual([
			ReactionCollectorPetFoodInvestigateReaction.name,
			ReactionCollectorPetFoodSendPetReaction.name,
			ReactionCollectorPetFoodContinueReaction.name
		]);
		expect(run.collector?.creationPacket.data.data).toMatchObject({
			foodType: FOOD.SOUP, petSex: "m"
		});
		expect(run.response).toContain(run.collector?.creationPacket);
		expect(isBlocked(player)).toBe(true);
		expect(await ignoresOtherPlayers(run)).toBe(true);
	});

	it("smells of soup on a path to the Road of Wonders too", async () => {
		mockPetEntity();
		vi.spyOn(MapLinkDataController.instance, "getById").mockReturnValue({
			id: 1, startMap: 2, endMap: MapConstants.LOCATIONS_IDS.ROAD_OF_WONDERS
		} as never);

		const run = await findFood(player);

		expect(run.collector?.creationPacket.data.data).toMatchObject({ foodType: FOOD.SOUP });
	});

	it("gives nothing when the player does not choose", async () => {
		const petEntity = mockPetEntity();

		const response = await endWithoutReaction(await findFood(player));

		expect(packetOf(response, SmallEventPetFoodPacket)).toEqual(expect.objectContaining({
			outcome: OUTCOMES.NOTHING, foodType: FOOD.SOUP, loveChange: 0, timeLost: undefined, petSex: "f"
		}));
		expect(petEntity.save).not.toHaveBeenCalled();
		expect(isBlocked(player)).toBe(false);
	});

	describe("investigation", () => {
		it("makes the player lose time and find the food below the chance of finding it", async () => {
			const petEntity = mockPetEntity({ lovePoints: 50 });
			mockRolls(0.69);

			const response = await reactWith(await findFood(player), ReactionCollectorPetFoodInvestigateReaction);

			expect(applyEffect).toHaveBeenCalledWith(player, Effect.OCCUPIED, SmallEventConstants.PET_FOOD.TRAVEL_TIME_PENALTY_MINUTES, expect.any(Date), expect.anything());
			expect(player.save).toHaveBeenCalled();
			expect(packetOf(response, SmallEventPetFoodPacket)).toEqual(expect.objectContaining({
				outcome: OUTCOMES.FOUND_BY_PLAYER, loveChange: LOVE.soup, timeLost: SmallEventConstants.PET_FOOD.TRAVEL_TIME_PENALTY_MINUTES
			}));
			expect(petEntity.lovePoints).toBe(50 + LOVE.soup);
			expect(petEntity.hungrySince).toEqual(TEST_NOW);
			expect(petEntity.save).toHaveBeenCalled();
		});

		it("makes the player lose time for nothing from the chance of finding it on", async () => {
			const petEntity = mockPetEntity({ lovePoints: 50 });
			mockRolls(0.7);

			const response = await reactWith(await findFood(player), ReactionCollectorPetFoodInvestigateReaction);

			expect(packetOf(response, SmallEventPetFoodPacket)).toEqual(expect.objectContaining({
				outcome: OUTCOMES.PLAYER_FAILED, loveChange: 0, timeLost: SmallEventConstants.PET_FOOD.TRAVEL_TIME_PENALTY_MINUTES
			}));
			expect(applyEffect).toHaveBeenCalled();
			expect(petEntity.lovePoints).toBe(50);
		});
	});

	describe("continuing", () => {
		it.each([
			[0.09, OUTCOMES.FOUND_ANYWAY, LOVE.soup],
			[0.1, OUTCOMES.NOTHING, 0]
		])("with a roll of %f ends with %s", async (roll, outcome, loveChange) => {
			mockPetEntity();
			mockRolls(roll);

			const response = await reactWith(await findFood(player), ReactionCollectorPetFoodContinueReaction);

			expect(packetOf(response, SmallEventPetFoodPacket)).toEqual(expect.objectContaining({
				outcome, loveChange, timeLost: undefined
			}));
			expect(applyEffect).not.toHaveBeenCalled();
		});
	});

	describe("sending the pet", () => {
		async function sendPet(hungryFor: number | null, roll: number): Promise<string> {
			mockPetEntity({
				typeId: CARNIVOROUS_PET, hungrySince: hungryFor === null ? null : new Date(TEST_NOW.getTime() - hungryFor)
			});
			mockRolls(roll);
			const response = await reactWith(await findFood(player), ReactionCollectorPetFoodSendPetReaction);
			return packetOf(response, SmallEventPetFoodPacket).outcome;
		}

		it("rarely finds the food when the pet is not hungry", async () => {
			expect(await sendPet(null, 0.099)).toBe(OUTCOMES.FOUND_BY_PET);
			expect(await sendPet(null, 0.1)).toBe(OUTCOMES.PET_FAILED);
			expect(await sendPet(CARNIVOROUS_FEED_DELAY - 1, 0.1)).toBe(OUTCOMES.PET_FAILED);
		});

		it("always finds the food when the pet is hungry", async () => {
			expect(await sendPet(CARNIVOROUS_FEED_DELAY, 0.999)).toBe(OUTCOMES.FOUND_BY_PET);
			expect(await sendPet(3 * CARNIVOROUS_FEED_DELAY, 0.999)).toBe(OUTCOMES.FOUND_BY_PET);
		});

		it("finds the food less often the longer the pet starves, the faster the stronger it is", async () => {
			// 1 - 10 h * force 8 * 0.003
			expect(await sendPet(3 * CARNIVOROUS_FEED_DELAY + 10 * HOUR, 0.759)).toBe(OUTCOMES.FOUND_BY_PET);
			expect(await sendPet(3 * CARNIVOROUS_FEED_DELAY + 10 * HOUR, 0.76)).toBe(OUTCOMES.PET_FAILED);
		});

		it("still finds the food sometimes when the pet starves", async () => {
			expect(await sendPet(3 * CARNIVOROUS_FEED_DELAY + 100 * HOUR, 0.099)).toBe(OUTCOMES.FOUND_BY_PET);
			expect(await sendPet(3 * CARNIVOROUS_FEED_DELAY + 100 * HOUR, 0.1)).toBe(OUTCOMES.PET_FAILED);
		});
	});

	describe("love of the pet", () => {
		async function feed(petTypeId: number, foodRoll: number, ...outcomeRolls: number[]): Promise<CrowniclesPacket[]> {
			inDesert();
			mockPetEntity({
				typeId: petTypeId, lovePoints: 50
			});
			const run = await findFood(player, foodRoll);
			mockRolls(0, ...outcomeRolls);
			return await reactWith(run, ReactionCollectorPetFoodInvestigateReaction);
		}

		it.each([
			["vegetarian food", 0.6, OMNIVOROUS_PET, LOVE.vegetarian],
			["vegetarian food", 0.7, HERBIVOROUS_PET, LOVE.vegetarian],
			["vegetarian food", 0.7, CARNIVOROUS_PET, 0],
			["meat", 0.85, OMNIVOROUS_PET, LOVE.meat],
			["meat", 0.85, CARNIVOROUS_PET, LOVE.meat],
			["meat", 0.85, HERBIVOROUS_PET, 0],
			["good smelling food", 0.95, CARNIVOROUS_PET, LOVE.goodSmell]
		])("changes by the love of %s for the pet %i", async (_food, foodRoll, petTypeId, loveChange) => {
			const response = await feed(petTypeId, foodRoll);

			expect(packetOf(response, SmallEventPetFoodPacket).loveChange).toBe(loveChange);
		});

		it("puts the pet off with a bad smell, but rarely", async () => {
			expect(packetOf(await feed(OMNIVOROUS_PET, 0, 0.099), SmallEventPetFoodPacket)).toMatchObject({
				foodType: FOOD.BAD_SMELL, loveChange: LOVE.badSmell
			});
			expect(packetOf(await feed(OMNIVOROUS_PET, 0, 0.1), SmallEventPetFoodPacket).loveChange).toBe(0);
		});

		it("keeps the love of the pet between zero and its maximum", async () => {
			const lovingPet = mockPetEntity({ lovePoints: PetConstants.MAX_LOVE_POINTS - 1 });
			mockRolls(0);
			await reactWith(await findFood(player), ReactionCollectorPetFoodInvestigateReaction);
			expect(lovingPet.lovePoints).toBe(PetConstants.MAX_LOVE_POINTS);

			inDesert();
			const hatingPet = mockPetEntity({ lovePoints: 0 });
			const run = await findFood(player, 0);
			mockRolls(0, 0);
			await reactWith(run, ReactionCollectorPetFoodInvestigateReaction);
			expect(hatingPet.lovePoints).toBe(0);
			expect(hatingPet.save).toHaveBeenCalled();
		});
	});
});
