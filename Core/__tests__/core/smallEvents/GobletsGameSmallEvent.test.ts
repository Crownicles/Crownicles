import {
	beforeEach, describe, expect, it, vi
} from "vitest";
import { smallEventFuncs } from "../../../src/core/smallEvents/gobletsGame";
import { TravelTime } from "../../../src/core/maps/TravelTime";
import { Maps } from "../../../src/core/maps/Maps";
import {
	generateRandomItem, giveItemToPlayer
} from "../../../src/core/utils/ItemUtils";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { MapConstants } from "../../../../Lib/src/constants/MapConstants";
import { ItemRarity } from "../../../../Lib/src/constants/ItemConstants";
import { Effect } from "../../../../Lib/src/types/Effect";
import {
	ReactionCollectorGobletsGameBiggestReaction,
	ReactionCollectorGobletsGameCrackedReaction,
	ReactionCollectorGobletsGameMetalReaction,
	ReactionCollectorGobletsGameSparklingReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorGobletsGame";
import {
	SmallEventGobletsGameMalus, SmallEventGobletsGamePacket, SmallEventGobletsGameStrategy
} from "../../../../Lib/src/packets/smallEvents/SmallEventGobletsGamePacket";
import {
	asPlayer, createTestPlayer, endWithoutReaction, isBlocked, packetOf, reactWith, runSmallEvent, TestPlayer, useSmallEventHarness
} from "./SmallEventHarness";

vi.mock("../../../src/core/utils/withLockedPlayerAndMissionsSafe", async () => ({
	withLockedPlayerAndMissionsSafe: (await import("./SmallEventHarness")).lockedPlayerPassthrough
}));

vi.mock("../../../src/core/utils/ItemUtils", async importOriginal => {
	const actual = await importOriginal<typeof import("../../../src/core/utils/ItemUtils")>();
	return {
		...actual,
		generateRandomItem: vi.fn(actual.generateRandomItem),
		giveItemToPlayer: vi.fn().mockResolvedValue(undefined)
	};
});

const VARIATION = 1;

function mockOutcome(roll: number, malus: SmallEventGobletsGameMalus = SmallEventGobletsGameMalus.LIFE): void {
	vi.spyOn(RandomUtils.crowniclesRandom, "realZeroToOneInclusive").mockReturnValue(roll);
	vi.spyOn(RandomUtils.crowniclesRandom, "pick").mockImplementation(list => (list.includes(malus) ? malus : list[0]) as never);
}

async function chooseGoblet(player: TestPlayer, goblet: { name: string }): Promise<SmallEventGobletsGamePacket> {
	const response = await reactWith(await runSmallEvent(smallEventFuncs, player), goblet);
	return packetOf(response, SmallEventGobletsGamePacket);
}

function onPath(startMap: number, endMap: number, onContinent = true): TestPlayer {
	vi.spyOn(Maps, "isOnContinent").mockReturnValue(onContinent);
	return Object.assign(createTestPlayer(), {
		getPreviousMap: () => ({ id: startMap }),
		getDestination: () => ({ id: endMap })
	});
}

describe("goblets game small event", () => {
	useSmallEventHarness();
	let applyEffect: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		applyEffect = vi.spyOn(TravelTime, "applyEffect").mockResolvedValue();
		vi.spyOn(RandomUtils, "variationInt").mockReturnValue(VARIATION);
		vi.mocked(generateRandomItem).mockClear();
		vi.mocked(giveItemToPlayer).mockClear();
	});

	describe("availability", () => {
		it("happens on the continent between two ordinary locations", () => {
			expect(smallEventFuncs.canBeExecuted(asPlayer(onPath(1, 2)), {} as never)).toBe(true);
		});

		it("does not happen outside the continent", () => {
			expect(smallEventFuncs.canBeExecuted(asPlayer(onPath(1, 2, false)), {} as never)).toBe(false);
		});

		it.each([
			MapConstants.LOCATIONS_IDS.ROAD_OF_WONDERS,
			MapConstants.LOCATIONS_IDS.MARSHY_ROAD,
			MapConstants.LOCATIONS_IDS.MOUNT_CELESTRUM
		])("does not happen on a path from or to the location %i", mapId => {
			expect(smallEventFuncs.canBeExecuted(asPlayer(onPath(mapId, 2)), {} as never)).toBe(false);
			expect(smallEventFuncs.canBeExecuted(asPlayer(onPath(1, mapId)), {} as never)).toBe(false);
		});

		it("does not happen when the path of the player is unknown", () => {
			vi.spyOn(Maps, "isOnContinent").mockReturnValue(true);
			const withoutDestination = Object.assign(createTestPlayer(), {
				getPreviousMap: () => ({ id: 1 }),
				getDestination: () => null
			});
			const withoutOrigin = Object.assign(createTestPlayer(), {
				getPreviousMap: () => null,
				getDestination: () => ({ id: 1 })
			});
			expect(smallEventFuncs.canBeExecuted(asPlayer(withoutDestination), {} as never)).toBe(false);
			expect(smallEventFuncs.canBeExecuted(asPlayer(withoutOrigin), {} as never)).toBe(false);
		});
	});

	it("offers the four goblets", async () => {
		const run = await runSmallEvent(smallEventFuncs, createTestPlayer());

		expect(run.response).toContain(run.collector?.creationPacket);
		expect(run.collector?.creationPacket.reactions).toHaveLength(4);
	});

	it("hurts harder a player who does not choose any goblet", async () => {
		const player = createTestPlayer({ level: 60 });

		const response = await endWithoutReaction(await runSmallEvent(smallEventFuncs, player));

		// (round(60 / 6) + 5 + 1) * 1.5 - 2.5 = 21.5
		const expectedLoss = 22;
		expect(packetOf(response, SmallEventGobletsGamePacket)).toMatchObject({
			malus: SmallEventGobletsGameMalus.END, goblet: "", value: expectedLoss, strategy: SmallEventGobletsGameStrategy.CLASSIC
		});
		expect(player.health).toBe(100 - expectedLoss);
		expect(player.save).toHaveBeenCalled();
		expect(isBlocked(player)).toBe(false);
	});

	it("leaves the player unharmed below the chance of nothing", async () => {
		const player = createTestPlayer({ level: 60 });
		mockOutcome(1 / 3 - 0.001);

		const packet = await chooseGoblet(player, ReactionCollectorGobletsGameMetalReaction);

		expect(packet).toMatchObject({
			malus: SmallEventGobletsGameMalus.NOTHING, goblet: "metal", value: 0, strategy: SmallEventGobletsGameStrategy.CLASSIC
		});
		expect(player.health).toBe(100);
		expect(applyEffect).not.toHaveBeenCalled();
	});

	it("hurts the player with the classic goblet from the chance of nothing on", async () => {
		const player = createTestPlayer({ level: 61 });
		mockOutcome(1 / 3, SmallEventGobletsGameMalus.LIFE);

		const packet = await chooseGoblet(player, ReactionCollectorGobletsGameMetalReaction);

		// round(61 / 6) + 5 + 1
		expect(packet).toMatchObject({
			malus: SmallEventGobletsGameMalus.LIFE, value: 16
		});
		expect(player.health).toBe(84);
		expect(player.save).toHaveBeenCalled();
	});

	it("makes the player lose less time with the safe goblet", async () => {
		const player = createTestPlayer({ level: 60 });
		mockOutcome(0, SmallEventGobletsGameMalus.TIME);

		const packet = await chooseGoblet(player, ReactionCollectorGobletsGameBiggestReaction);

		// (round(60 * 0.42) + 6 + 1) * 2 / 3 = 21.33
		expect(packet).toMatchObject({
			malus: SmallEventGobletsGameMalus.TIME, goblet: "biggest", value: 21, strategy: SmallEventGobletsGameStrategy.SAFE
		});
		expect(applyEffect).toHaveBeenCalledWith(player, Effect.OCCUPIED, 21, expect.any(Date), expect.anything());
		expect(player.health).toBe(100);
	});

	it("hurts the gambler much harder when the cracked goblet fails", async () => {
		const player = createTestPlayer({ level: 60 });
		mockOutcome(0.8, SmallEventGobletsGameMalus.LIFE);

		const packet = await chooseGoblet(player, ReactionCollectorGobletsGameCrackedReaction);

		// (10 + 5 + 1) * 3.3 = 52.8
		expect(packet).toMatchObject({
			malus: SmallEventGobletsGameMalus.LIFE, value: 53, strategy: SmallEventGobletsGameStrategy.GAMBLER
		});
		expect(player.health).toBe(47);
	});

	it("spares the gambler most of the time", async () => {
		const player = createTestPlayer();
		mockOutcome(0.79);

		expect((await chooseGoblet(player, ReactionCollectorGobletsGameCrackedReaction)).malus).toBe(SmallEventGobletsGameMalus.NOTHING);
	});

	describe("sparkling goblet", () => {
		it("leaves the player unharmed below its chance of nothing", async () => {
			mockOutcome(0.099);
			expect((await chooseGoblet(createTestPlayer(), ReactionCollectorGobletsGameSparklingReaction)).malus).toBe(SmallEventGobletsGameMalus.NOTHING);
		});

		it("gives at least a special item right after the chance of nothing to a player below the epic level", async () => {
			const player = createTestPlayer({ level: 99 });
			mockOutcome(0.1);

			const packet = await chooseGoblet(player, ReactionCollectorGobletsGameSparklingReaction);

			expect(generateRandomItem).toHaveBeenCalledWith({
				minRarity: ItemRarity.SPECIAL, maxRarity: ItemRarity.MYTHICAL
			});
			const item = vi.mocked(generateRandomItem).mock.results[0].value;
			expect(packet).toMatchObject({
				malus: SmallEventGobletsGameMalus.ITEM, goblet: "sparkling", strategy: SmallEventGobletsGameStrategy.RISKY, itemId: item.id, itemCategory: item.getCategory()
			});
			expect(giveItemToPlayer).toHaveBeenCalledWith(expect.any(Array), expect.anything(), player, item, expect.objectContaining({ itemLevel: expect.any(Number) }));
			expect(player.health).toBe(100);
		});

		it("gives at least an epic item to a player of the epic level", async () => {
			mockOutcome(0.119);

			await chooseGoblet(createTestPlayer({ level: 100 }), ReactionCollectorGobletsGameSparklingReaction);

			expect(generateRandomItem).toHaveBeenCalledWith({
				minRarity: ItemRarity.EPIC, maxRarity: ItemRarity.MYTHICAL
			});
		});

		it("hurts the player past the chance of an item", async () => {
			const player = createTestPlayer({ level: 60 });
			mockOutcome(0.1 + 0.02, SmallEventGobletsGameMalus.TIME);

			const packet = await chooseGoblet(player, ReactionCollectorGobletsGameSparklingReaction);

			// round(60 * 0.42) + 6 + 1
			expect(packet).toMatchObject({
				malus: SmallEventGobletsGameMalus.TIME, value: 32
			});
			expect(giveItemToPlayer).not.toHaveBeenCalled();
		});
	});
});
