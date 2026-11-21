import {
	beforeEach, describe, expect, it, vi
} from "vitest";
import { smallEventFuncs } from "../../../src/core/smallEvents/badPet";
import { Maps } from "../../../src/core/maps/Maps";
import {
	PetEntities, PetEntity
} from "../../../src/core/database/game/models/PetEntity";
import { PetDataController } from "../../../src/data/Pet";
import { PetUtils } from "../../../src/core/utils/PetUtils";
import { Guilds } from "../../../src/core/database/game/models/Guild";
import { InventorySlots } from "../../../src/core/database/game/models/InventorySlot";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { SmallEventConstants } from "../../../../Lib/src/constants/SmallEventConstants";
import { MapConstants } from "../../../../Lib/src/constants/MapConstants";
import { PetConstants } from "../../../../Lib/src/constants/PetConstants";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { ReactionCollectorBadPetReaction } from "../../../../Lib/src/packets/interaction/ReactionCollectorBadPetSmallEvent";
import { SmallEventBadPetPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventBadPetPacket";
import {
	asPlayer, createTestPlayer, endWithoutReaction, ignoresOtherPlayers, isBlocked, packetOf, react, runSmallEvent, SmallEventRun, TestPlayer, useSmallEventHarness
} from "./SmallEventHarness";

const BAD_PET = SmallEventConstants.BAD_PET;
const ACTIONS = BAD_PET.ACTION_IDS;
const OUTCOMES = BAD_PET.OUTCOME_TYPES;
const LOVE_LOST = BAD_PET.LOVE_LOST;
const THRESHOLDS = BAD_PET.THRESHOLDS;

type TestPetEntity = {
	id: number;
	typeId: number;
	sex: string;
	nickname: string | null;
	lovePoints: number;
	changeLovePoints: ReturnType<typeof vi.fn>;
	save: ReturnType<typeof vi.fn>;
};

type TestPetModel = {
	force: number;
	rarity: number;
	canEatMeat: () => boolean;
	canEatVegetables: () => boolean;
};

type BadPetPlayer = TestPlayer & {
	speed: number;
	defense: number;
	getCumulativeSpeed: () => number;
	getCumulativeDefense: () => number;
};

type TestGuild = {
	carnivorousFood: number;
	herbivorousFood: number;
	save: ReturnType<typeof vi.fn>;
};

function createBadPetPlayer(): BadPetPlayer {
	const player = Object.assign(createTestPlayer({
		petId: 7, guildId: 3
	}), {
		speed: 0,
		defense: 0,
		getCumulativeSpeed: (): number => player.speed,
		getCumulativeDefense: (): number => player.defense
	});
	return player;
}

function mockPetEntity(lovePoints = 50): TestPetEntity {
	const petEntity: TestPetEntity = {
		id: 7,
		typeId: 12,
		sex: "f",
		nickname: "Moltiar's victim",
		lovePoints,
		changeLovePoints: vi.fn((parameters: { amount: number }) => {
			petEntity.lovePoints += parameters.amount;
			return Promise.resolve();
		}),
		save: vi.fn().mockResolvedValue(undefined)
	};
	vi.spyOn(PetEntity, "findOne").mockResolvedValue(petEntity as never);
	vi.spyOn(PetEntities, "getById").mockResolvedValue(petEntity as never);
	return petEntity;
}

function mockPetModel(model: Partial<TestPetModel> = {}): void {
	vi.spyOn(PetDataController.instance, "getById").mockReturnValue({
		force: 10,
		rarity: 1,
		canEatMeat: () => true,
		canEatVegetables: () => true,
		...model
	} as never);
}

function mockGuild(food: Partial<Pick<TestGuild, "carnivorousFood" | "herbivorousFood">>): TestGuild {
	const guild: TestGuild = {
		carnivorousFood: 0,
		herbivorousFood: 0,
		save: vi.fn().mockResolvedValue(undefined),
		...food
	};
	vi.spyOn(Guilds, "getById").mockResolvedValue(guild as never);
	return guild;
}

/**
 * The love lost on a failure is drawn between the bounds of the action: answer the highest value to tell the bounds apart
 */
function mockLoveLostDraws(): void {
	vi.spyOn(RandomUtils, "randInt").mockImplementation((_min, max) => max - 1);
}

function mockSuccess(success: boolean): ReturnType<typeof vi.spyOn> {
	return vi.spyOn(RandomUtils.crowniclesRandom, "bool").mockReturnValue(success);
}

function offeredActionIds(run: SmallEventRun): string[] {
	return (run.collector?.creationPacket.reactions ?? []).map(reaction => (reaction.data as ReactionCollectorBadPetReaction).id);
}

describe("Moltiar, the bad pet small event", () => {
	useSmallEventHarness();
	let player: BadPetPlayer;
	let petEntity: TestPetEntity;

	async function choose(actionId: string): Promise<SmallEventBadPetPacket> {
		const run = await runSmallEvent(smallEventFuncs, player, { testArgs: [actionId] });
		const response = await react(run, reaction => (reaction.data as ReactionCollectorBadPetReaction).id === actionId);
		return packetOf(response, SmallEventBadPetPacket);
	}

	beforeEach(() => {
		player = createBadPetPlayer();
		petEntity = mockPetEntity();
		mockPetModel();
		vi.spyOn(InventorySlots, "getPlayerActiveObjects").mockResolvedValue({} as never);
	});

	describe("availability", () => {
		function onPath(startMap: number, endMap: number): BadPetPlayer {
			return Object.assign(player, {
				getPreviousMap: () => ({ id: startMap }),
				getDestination: () => ({ id: endMap })
			});
		}

		function canBeExecuted(onPathPlayer: BadPetPlayer): Promise<boolean> {
			return Promise.resolve(smallEventFuncs.canBeExecuted(asPlayer(onPathPlayer), {} as never));
		}

		beforeEach(() => {
			vi.spyOn(Maps, "isOnContinent").mockReturnValue(true);
			vi.spyOn(PetUtils, "isPetAvailable").mockResolvedValue(true);
		});

		it("happens on the continent to a player whose available pet loves them", async () => {
			mockPetEntity(1);
			expect(await canBeExecuted(onPath(1, 2))).toBe(true);
		});

		it("does not happen outside the continent", async () => {
			vi.spyOn(Maps, "isOnContinent").mockReturnValue(false);
			expect(await canBeExecuted(onPath(1, 2))).toBe(false);
		});

		it("avoids the paths from or to Mount Celestrum", async () => {
			expect(await canBeExecuted(onPath(MapConstants.LOCATIONS_IDS.MOUNT_CELESTRUM, 2))).toBe(false);
			expect(await canBeExecuted(onPath(1, MapConstants.LOCATIONS_IDS.MOUNT_CELESTRUM))).toBe(false);
		});

		it("does not happen when the path of the player is unknown", async () => {
			expect(await canBeExecuted(Object.assign(player, {
				getPreviousMap: () => ({ id: 1 }), getDestination: () => null
			}))).toBe(false);
			expect(await canBeExecuted(Object.assign(player, {
				getPreviousMap: () => null, getDestination: () => ({ id: 1 })
			}))).toBe(false);
		});

		it("does not happen when the pet is not available or does not love the player anymore", async () => {
			vi.spyOn(PetUtils, "isPetAvailable").mockResolvedValue(false);
			expect(await canBeExecuted(onPath(1, 2))).toBe(false);

			vi.spyOn(PetUtils, "isPetAvailable").mockResolvedValue(true);
			mockPetEntity(0);
			expect(await canBeExecuted(onPath(1, 2))).toBe(false);
		});
	});

	describe("offered actions", () => {
		it("offers three distinct actions about the pet of the player only", async () => {
			const allActions: string[] = Object.values(ACTIONS);
			for (let i = 0; i < 20; i++) {
				const actionIds = offeredActionIds(await runSmallEvent(smallEventFuncs, player));
				expect(actionIds).toHaveLength(BAD_PET.ACTIONS_TO_SHOW);
				expect(new Set(actionIds).size).toBe(BAD_PET.ACTIONS_TO_SHOW);
				for (const actionId of actionIds) {
					expect(allActions).toContain(actionId);
				}
			}

			const run = await runSmallEvent(smallEventFuncs, player);
			expect(run.collector?.creationPacket.data.data).toMatchObject({
				petId: 12, sex: "f", petNickname: "Moltiar's victim"
			});
			expect(run.response).toContain(run.collector?.creationPacket);
			expect(isBlocked(player)).toBe(true);
			expect(await ignoresOtherPlayers(run)).toBe(true);
		});

		it("shuffles every action into the offer", async () => {
			const seen = new Set<string>();
			for (let i = 0; i < 100; i++) {
				offeredActionIds(await runSmallEvent(smallEventFuncs, player)).forEach(actionId => seen.add(actionId));
			}
			expect(seen.size).toBe(Object.values(ACTIONS).length);
		});

		it("offers the actions forced by the test command, or random ones when none exists", async () => {
			expect(offeredActionIds(await runSmallEvent(smallEventFuncs, player, { testArgs: [ACTIONS.CALM, "unknown", ACTIONS.FLEE] })))
				.toEqual([ACTIONS.CALM, ACTIONS.FLEE]);
			expect(offeredActionIds(await runSmallEvent(smallEventFuncs, player, { testArgs: ["unknown"] })))
				.toHaveLength(BAD_PET.ACTIONS_TO_SHOW);
		});
	});

	it("makes the pet lose love when the player does not choose, as if they waited", async () => {
		const response = await endWithoutReaction(await runSmallEvent(smallEventFuncs, player));

		expect(packetOf(response, SmallEventBadPetPacket)).toEqual(expect.objectContaining({
			loveLost: LOVE_LOST.WAIT, interactionType: ACTIONS.WAIT, petId: 12, sex: "f", petNickname: "Moltiar's victim"
		}));
		expect(petEntity.changeLovePoints).toHaveBeenCalledWith(expect.objectContaining({
			player, amount: -LOVE_LOST.WAIT, reason: NumberChangeReason.SMALL_EVENT
		}));
		expect(petEntity.lovePoints).toBe(50 - LOVE_LOST.WAIT);
		expect(petEntity.save).toHaveBeenCalled();
		expect(isBlocked(player)).toBe(false);
	});

	it("makes the pet lose love when the player waits", async () => {
		const packet = await choose(ACTIONS.WAIT);

		expect(PetEntity.findOne).toHaveBeenCalledWith({ where: { id: player.petId } });
		expect(packet).toMatchObject({
			loveLost: LOVE_LOST.WAIT, interactionType: ACTIONS.WAIT
		});
		expect(petEntity.lovePoints).toBe(50 - LOVE_LOST.WAIT);
	});

	it("does not change the love of a pet that left in the meantime", async () => {
		const run = await runSmallEvent(smallEventFuncs, player, { testArgs: [ACTIONS.CALM] });
		vi.spyOn(PetEntity, "findOne").mockResolvedValue(null);
		const bool = mockSuccess(false);

		const response = await react(run, () => true);

		expect(packetOf(response, SmallEventBadPetPacket)).toMatchObject({
			loveLost: LOVE_LOST.WAIT, interactionType: ACTIONS.WAIT
		});
		expect(bool).not.toHaveBeenCalled();
		expect(petEntity.changeLovePoints).not.toHaveBeenCalled();
	});

	it("makes the pet lose the love of waiting when its kind is unknown", async () => {
		vi.spyOn(PetDataController.instance, "getById").mockReturnValue(undefined);

		const packet = await choose(ACTIONS.CALM);

		expect(packet).toMatchObject({
			loveLost: LOVE_LOST.WAIT, interactionType: ACTIONS.WAIT
		});
		expect(petEntity.lovePoints).toBe(50 - LOVE_LOST.WAIT);
	});

	it("keeps the love of a pet when the action works", async () => {
		mockSuccess(true);

		const packet = await choose(ACTIONS.DISTRACT);

		expect(packet).toMatchObject({
			loveLost: 0, interactionType: ACTIONS.DISTRACT
		});
		expect(petEntity.changeLovePoints).not.toHaveBeenCalled();
		expect(petEntity.save).not.toHaveBeenCalled();
	});

	describe("intimidating and pleading", () => {
		beforeEach(() => {
			mockLoveLostDraws();
		});

		it.each([
			[ACTIONS.INTIMIDATE, THRESHOLDS.PET_FORCE_STRONG, LOVE_LOST.INTIMIDATE.STRONG_MAX - 1],
			[ACTIONS.INTIMIDATE, THRESHOLDS.PET_FORCE_STRONG - 1, LOVE_LOST.INTIMIDATE.WEAK_MAX - 1],
			[ACTIONS.PLEAD, THRESHOLDS.PET_FORCE_STRONG, LOVE_LOST.PLEAD.STRONG_MAX - 1],
			[ACTIONS.PLEAD, THRESHOLDS.PET_FORCE_STRONG - 1, LOVE_LOST.PLEAD.WEAK_MAX - 1]
		])("%s a pet of force %i makes it lose up to %i love", async (actionId, force, loveLost) => {
			mockPetModel({ force });

			const packet = await choose(actionId);

			expect(packet).toMatchObject({
				loveLost, interactionType: actionId
			});
			expect(petEntity.lovePoints).toBe(50 - loveLost);
		});

		it("draws the love lost from the lower bound of the action", async () => {
			mockPetModel({ force: THRESHOLDS.PET_FORCE_STRONG });
			vi.spyOn(RandomUtils, "randInt").mockImplementation(min => min);

			expect((await choose(ACTIONS.PLEAD)).loveLost).toBe(LOVE_LOST.PLEAD.STRONG_MIN);
			expect((await choose(ACTIONS.INTIMIDATE)).loveLost).toBe(LOVE_LOST.INTIMIDATE.STRONG_MIN);
		});
	});

	describe("giving food", () => {
		it.each([
			[ACTIONS.GIVE_MEAT, OUTCOMES.GIVE_MEAT_NO_FOOD],
			[ACTIONS.GIVE_VEG, OUTCOMES.GIVE_VEG_NO_FOOD]
		])("%s without guild makes the pet lose love", async (actionId, outcome) => {
			player.guildId = null;

			expect(await choose(actionId)).toMatchObject({
				loveLost: LOVE_LOST.GIVE_FOOD.NO_FOOD, interactionType: outcome
			});
		});

		it("does not take food from a guild without any", async () => {
			const guild = mockGuild({
				carnivorousFood: 0, herbivorousFood: 5
			});

			expect(await choose(ACTIONS.GIVE_MEAT)).toMatchObject({
				loveLost: LOVE_LOST.GIVE_FOOD.NO_FOOD, interactionType: OUTCOMES.GIVE_MEAT_NO_FOOD
			});
			expect(Guilds.getById).toHaveBeenCalledWith(3);
			expect(guild.carnivorousFood).toBe(0);
			expect(guild.save).not.toHaveBeenCalled();
		});

		it.each([
			[ACTIONS.GIVE_MEAT, "carnivorousFood", OUTCOMES.GIVE_MEAT_LIKES],
			[ACTIONS.GIVE_VEG, "herbivorousFood", OUTCOMES.GIVE_VEG_LIKES]
		] as const)("%s takes one %s from the guild, and the pet that likes it is jealous", async (actionId, food, outcome) => {
			const guild = mockGuild({ [food]: 1 });
			mockLoveLostDraws();

			expect(await choose(actionId)).toMatchObject({
				loveLost: LOVE_LOST.GIVE_FOOD.JEALOUS_MAX - 1, interactionType: outcome
			});
			expect(guild[food]).toBe(0);
			expect(guild.save).toHaveBeenCalled();
		});

		it.each([
			[ACTIONS.GIVE_MEAT, "carnivorousFood", OUTCOMES.GIVE_MEAT_DISLIKES, { canEatMeat: (): boolean => false }],
			[ACTIONS.GIVE_VEG, "herbivorousFood", OUTCOMES.GIVE_VEG_DISLIKES, { canEatVegetables: (): boolean => false }]
		] as const)("%s takes one %s from the guild, which a pet that dislikes it rarely accepts", async (actionId, food, outcome, diet) => {
			const guild = mockGuild({ [food]: 2 });
			mockPetModel(diet);
			const bool = mockSuccess(false);

			expect(await choose(actionId)).toMatchObject({
				loveLost: LOVE_LOST.GIVE_FOOD.DISLIKES_AMOUNT, interactionType: outcome
			});
			expect(bool).toHaveBeenCalledWith(LOVE_LOST.GIVE_FOOD.DISLIKES_SUCCESS_CHANCE);
			expect(guild[food]).toBe(1);

			mockSuccess(true);
			expect((await choose(actionId)).loveLost).toBe(0);
		});
	});

	describe("actions with a chance of success", () => {
		beforeEach(() => {
			mockLoveLostDraws();
		});

		async function chanceOf(actionId: string): Promise<{
			chance: number; loveLost: number;
		}> {
			const bool = mockSuccess(false);
			const packet = await choose(actionId);
			expect(packet.interactionType).toBe(actionId);
			return {
				chance: bool.mock.lastCall?.[0] as number, loveLost: packet.loveLost
			};
		}

		it("lets a fast player flee", async () => {
			player.speed = THRESHOLDS.PLAYER_SPEED_FAST + 1;
			expect(await chanceOf(ACTIONS.FLEE)).toEqual({
				chance: THRESHOLDS.FLEE_SUCCESS_CHANCE_FAST, loveLost: LOVE_LOST.FLEE.MAX - 1
			});

			player.speed = THRESHOLDS.PLAYER_SPEED_FAST;
			expect((await chanceOf(ACTIONS.FLEE)).chance).toBe(0);
		});

		it("lets a weak pet hide", async () => {
			mockPetModel({ force: THRESHOLDS.PET_FORCE_WEAK - 1 });
			expect(await chanceOf(ACTIONS.HIDE)).toEqual({
				chance: THRESHOLDS.HIDE_SUCCESS_CHANCE_WEAK, loveLost: LOVE_LOST.HIDE.MAX - 1
			});

			mockPetModel({ force: THRESHOLDS.PET_FORCE_WEAK });
			expect((await chanceOf(ACTIONS.HIDE)).chance).toBe(0);
		});

		it("lets the player protect the pet better with more defense, up to a cap", async () => {
			player.defense = THRESHOLDS.PLAYER_DEFENSE_MAX / 2;
			expect(await chanceOf(ACTIONS.PROTECT)).toEqual({
				chance: THRESHOLDS.PROTECT_MAX_SUCCESS_CHANCE / 2, loveLost: LOVE_LOST.PROTECT.FAIL_MAX - 1
			});

			player.defense = THRESHOLDS.PLAYER_DEFENSE_MAX * 2;
			expect((await chanceOf(ACTIONS.PROTECT)).chance).toBe(THRESHOLDS.PROTECT_MAX_SUCCESS_CHANCE);
		});

		it("distracts the bad pet half of the time", async () => {
			expect(await chanceOf(ACTIONS.DISTRACT)).toEqual({
				chance: THRESHOLDS.DISTRACT_SUCCESS_CHANCE, loveLost: LOVE_LOST.DISTRACT.FAIL_MAX - 1
			});
		});

		it("calms a pet that loves the player more easily", async () => {
			petEntity.lovePoints = PetConstants.MAX_LOVE_POINTS / 2;
			expect(await chanceOf(ACTIONS.CALM)).toEqual({
				chance: 0.6, loveLost: LOVE_LOST.CALM.FAIL_MAX - 1
			});
		});

		it("imposes on a rare pet more easily", async () => {
			mockPetModel({ rarity: 3 });
			const { chance, loveLost } = await chanceOf(ACTIONS.IMPOSER);
			expect(chance).toBeCloseTo(0.4);
			expect(loveLost).toBe(LOVE_LOST.IMPOSER.FAIL_MAX - 1);
		});

		it("energizes a vigorous pet more easily", async () => {
			const vigor = vi.spyOn(PetUtils, "getPetVigor").mockReturnValue(PetConstants.VIGOR.MAX / 2);

			const { chance, loveLost } = await chanceOf(ACTIONS.ENERGIZE);

			expect(vigor).toHaveBeenCalledWith(expect.objectContaining({ force: 10 }), 50);
			expect(chance).toBeCloseTo(0.525);
			expect(loveLost).toBe(LOVE_LOST.ENERGIZE.FAIL_MAX - 1);
		});
	});
});
