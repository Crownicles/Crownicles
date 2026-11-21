import {
	afterEach, beforeEach, describe, expect, it, vi
} from "vitest";

const logSmallEvent = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("../../../src/app", () => ({
	crowniclesInstance: { logsDatabase: { logSmallEvent } }
}));

vi.mock("../../../src/core/missions/MissionsController", () => ({
	MissionsController: { update: vi.fn().mockResolvedValue(undefined) }
}));

vi.mock("../../../src/core/utils/withLockedPlayerAndMissionsSafe", () => ({ withLockedPlayerAndMissionsSafe: vi.fn() }));

import { executeSmallEvent } from "../../../src/core/report/ReportSmallEventService";
import { Player } from "../../../src/core/database/game/models/Player";
import {
	SmallEventDataController, SmallEventFuncs
} from "../../../src/data/SmallEvent";
import { PlayerSmallEvents } from "../../../src/core/database/game/models/PlayerSmallEvent";
import { InventorySlots } from "../../../src/core/database/game/models/InventorySlot";
import { PlayerActiveObjects } from "../../../src/core/database/game/models/PlayerActiveObjects";
import { MissionsController } from "../../../src/core/missions/MissionsController";
import { withLockedPlayerAndMissionsSafe } from "../../../src/core/utils/withLockedPlayerAndMissionsSafe";
import { PacketUtils } from "../../../src/core/utils/PacketUtils";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { SmallEventConstants } from "../../../../Lib/src/constants/SmallEventConstants";
import {
	CrowniclesPacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { LockKey } from "../../../../Lib/src/locks/withLockedEntities";

const context = { keycloakId: "traveller" } as PacketContext;
const activeObjects = {} as PlayerActiveObjects;
const NOW = 1_780_000_000_000;

interface SmallEventDouble {
	rarity: number;
	canBeExecuted?: boolean;
	isGuaranteed?: boolean;
	timesMet?: number;
	missingFunctions?: boolean;
}

let player: Player;
let lockedPlayer: Player;
let funcs: Map<string, SmallEventFuncs>;
let timesMet: Map<string, number>;
let savedRecords: { playerId: number; eventType: string; time: number }[];

function smallEvents(doubles: Record<string, SmallEventDouble>): void {
	funcs = new Map();
	timesMet = new Map();
	for (const [key, double] of Object.entries(doubles)) {
		timesMet.set(key, double.timesMet ?? 0);
		if (double.missingFunctions) {
			continue;
		}
		funcs.set(key, {
			canBeExecuted: vi.fn().mockResolvedValue(double.canBeExecuted ?? true),
			executeSmallEvent: vi.fn().mockResolvedValue(undefined),
			...double.isGuaranteed === undefined ? {} : { isGuaranteed: vi.fn().mockResolvedValue(double.isGuaranteed) }
		} as SmallEventFuncs);
	}
	vi.spyOn(SmallEventDataController.instance, "getKeys").mockReturnValue(Object.keys(doubles));
	vi.spyOn(SmallEventDataController, "getSmallEventFunction").mockImplementation(key => funcs.get(key));
	vi.spyOn(SmallEventDataController.instance, "getById").mockImplementation(key => ({ rarity: doubles[key].rarity }) as ReturnType<typeof SmallEventDataController.instance.getById>);
	vi.spyOn(PlayerSmallEvents, "playerSmallEventCount").mockImplementation((_playerId, key) => Promise.resolve(timesMet.get(key) ?? 0));
}

async function run(forced: string | null = null): Promise<CrowniclesPacket[]> {
	const response: CrowniclesPacket[] = [];
	await executeSmallEvent(response, player, context, forced);
	return response;
}

function executed(key: string): boolean {
	return vi.mocked(funcs.get(key)?.executeSmallEvent ?? vi.fn()).mock.calls.length > 0;
}

beforeEach(() => {
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(NOW);
	player = {
		id: 4, keycloakId: "traveller"
	} as Player;
	lockedPlayer = {
		id: 4, keycloakId: "traveller", save: vi.fn().mockResolvedValue(undefined)
	} as unknown as Player; // Only the saved row of the lock is used
	savedRecords = [];
	vi.spyOn(InventorySlots, "getPlayerActiveObjects").mockResolvedValue(activeObjects);
	vi.spyOn(PlayerSmallEvents, "countSmallEventsOfPlayer").mockResolvedValue(0);
	vi.spyOn(PlayerSmallEvents, "createPlayerSmallEvent").mockImplementation((playerId, eventType, time) => ({
		save: () => {
			savedRecords.push({
				playerId, eventType, time
			});
			return Promise.resolve();
		}
	}) as unknown as ReturnType<typeof PlayerSmallEvents.createPlayerSmallEvent>); // Only the save of the new record is used
	vi.spyOn(PacketUtils, "pushInternalError").mockReturnValue(undefined);
	vi.mocked(withLockedPlayerAndMissionsSafe).mockImplementation((_player, _label, body) => body(lockedPlayer));
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
	vi.mocked(MissionsController.update).mockClear();
	vi.mocked(withLockedPlayerAndMissionsSafe).mockClear();
	logSmallEvent.mockClear();
});

describe("executeSmallEvent", () => {
	it("should run a forced small event under the player lock, recorded before it runs, then count the report", async () => {
		const lockKeys = [{ model: "homes", id: 1 }] as unknown as LockKey<never>[]; // Opaque keys forwarded to the lock
		smallEvents({ forced: { rarity: 1 } });
		const forced = funcs.get("forced");
		if (!forced) {
			throw new Error("missing double");
		}
		forced.getAdditionalLockKeys = vi.fn().mockResolvedValue(lockKeys);
		vi.mocked(forced.executeSmallEvent).mockImplementation(() => {
			expect(savedRecords).toEqual([{
				playerId: 4, eventType: "forced", time: NOW
			}]);
			return Promise.resolve();
		});

		const response = await run("forced");

		expect(logSmallEvent).toHaveBeenCalledWith("traveller", "forced");
		expect(withLockedPlayerAndMissionsSafe).toHaveBeenCalledWith(player, "runSmallEventUnderPlayerLock", expect.any(Function), lockKeys);
		expect(forced.getAdditionalLockKeys).toHaveBeenCalledWith(player);
		expect(forced.executeSmallEvent).toHaveBeenCalledWith(lockedPlayer, {
			response, context, playerActiveObjects: activeObjects
		});
		expect(lockedPlayer.save).toHaveBeenCalledOnce();
		expect(MissionsController.update).toHaveBeenCalledWith(lockedPlayer, response, { missionId: "doReports" });
		expect(forced.canBeExecuted).not.toHaveBeenCalled();
		expect(PacketUtils.pushInternalError).not.toHaveBeenCalled();
	});

	it("should lock only the player and its missions when the small event needs nothing else", async () => {
		smallEvents({ simple: { rarity: 1 } });

		await run("simple");

		expect(withLockedPlayerAndMissionsSafe).toHaveBeenCalledWith(player, "runSmallEventUnderPlayerLock", expect.any(Function), []);
	});

	it("should report a forced small event without implementation", async () => {
		smallEvents({});

		const response = await run("ghost");

		expect(PacketUtils.pushInternalError).toHaveBeenCalledWith(response, "Small event file ghost.js doesn't exist");
		expect(logSmallEvent).not.toHaveBeenCalled();
	});

	it("should report a crashing small event instead of failing the report", async () => {
		smallEvents({ crashing: { rarity: 1 } });
		const failure = new Error("boom");
		vi.mocked(funcs.get("crashing")?.executeSmallEvent ?? vi.fn()).mockRejectedValue(failure);

		const response = await run("crashing");

		expect(PacketUtils.pushInternalError).toHaveBeenCalledWith(response, "Error while executing crashing.js small event", { cause: failure });
		expect(MissionsController.update).not.toHaveBeenCalled();
	});

	it("should report when no small event can happen", async () => {
		smallEvents({ impossible: {
			rarity: 1, canBeExecuted: false
		} });

		const response = await run();

		expect(PacketUtils.pushInternalError).toHaveBeenCalledWith(response, "No small event can be executed", { context: { keycloakId: "traveller" } });
		expect(executed("impossible")).toBe(false);
	});

	it("should check the eligibility with the active objects, and report a small event without implementation", async () => {
		smallEvents({
			broken: {
				rarity: 5, missingFunctions: true
			},
			fine: { rarity: 5 }
		});

		const response = await run();

		expect(PacketUtils.pushInternalError).toHaveBeenCalledWith(response, "Small event broken doesn't export its functions");
		expect(funcs.get("fine")?.canBeExecuted).toHaveBeenCalledWith(player, activeObjects);
		expect(executed("fine")).toBe(true);
	});

	describe("weighted draw", () => {
		beforeEach(() => {
			smallEvents({
				common: { rarity: 1 },
				skipped: {
					rarity: 50, canBeExecuted: false
				},
				uncommon: { rarity: 3 },
				rare: { rarity: 6 }
			});
		});

		it.each([
			[1, "common"],
			[2, "uncommon"],
			[4, "uncommon"],
			[5, "rare"],
			[10, "rare"]
		])("should pick, for the draw %i, the eligible small event whose cumulated rarity reaches it (%s)", async (draw, expected) => {
			const randInt = vi.spyOn(RandomUtils, "randInt").mockReturnValue(draw);

			await run();

			expect(randInt).toHaveBeenCalledWith(1, 11);
			expect(executed(expected)).toBe(true);
			expect([...funcs.keys()].filter(executed)).toEqual([expected]);
		});

		it("should execute nothing when the draw is above the total rarity", async () => {
			vi.spyOn(RandomUtils, "randInt").mockReturnValue(11);

			await run();

			expect([...funcs.keys()].filter(executed)).toEqual([]);
			expect(PacketUtils.pushInternalError).toHaveBeenCalledWith(expect.any(Array), "No small event can be executed", expect.anything());
		});
	});

	it("should run the guaranteed small event at the right point of the path without drawing", async () => {
		smallEvents({
			random: { rarity: 100 },
			guaranteed: {
				rarity: 1, isGuaranteed: true
			}
		});
		vi.mocked(PlayerSmallEvents.countSmallEventsOfPlayer).mockResolvedValue(SmallEventConstants.GUARANTEED_AFTER_SMALL_EVENTS);
		const randInt = vi.spyOn(RandomUtils, "randInt");

		await run();

		expect(executed("guaranteed")).toBe(true);
		expect(executed("random")).toBe(false);
		expect(randInt).not.toHaveBeenCalled();
	});
});
