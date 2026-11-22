import {
	afterEach, beforeEach, describe, expect, it, vi
} from "vitest";

const doubles = vi.hoisted(() => ({
	logBigEvent: vi.fn().mockResolvedValue(undefined),
	collectors: [] as {
		reactionCollector: unknown;
		collectorOptions: { allowedPlayerKeycloakIds: string[] };
		endCallback: (collector: unknown, response: unknown[]) => Promise<void>;
		block: ReturnType<typeof vi.fn>;
	}[]
}));

vi.mock("../../../src/app", () => ({
	crowniclesInstance: { logsDatabase: { logBigEvent: doubles.logBigEvent } }
}));

vi.mock("../../../src/core/missions/MissionsController", () => ({
	MissionsController: { update: vi.fn().mockResolvedValue(undefined) }
}));

vi.mock("../../../src/core/report/ReportDestinationService", () => ({ chooseDestination: vi.fn().mockResolvedValue(undefined) }));

vi.mock("../../../src/core/report/ReportBigEventFightService", () => ({ startBigEventFight: vi.fn().mockResolvedValue(undefined) }));

// Outcome requirements are covered by PossibilityOutcome.test.ts: here every outcome is valid
vi.mock("../../../src/data/events/PossibilityOutcome", () => ({
	applyPossibilityOutcome: vi.fn().mockResolvedValue(null),
	getValidOutcomesForPlayer: vi.fn((outcomes: object) => Promise.resolve(Object.entries(outcomes)))
}));

vi.mock("../../../src/data/events/PossibilityOutcomeCondition", () => ({ verifyPossibilityOutcomeCondition: vi.fn().mockResolvedValue(true) }));

vi.mock("../../../../Lib/src/locks/withLockedEntities", async importOriginal => ({
	...await importOriginal<typeof import("../../../../Lib/src/locks/withLockedEntities")>(),
	withLockedEntities: vi.fn()
}));

vi.mock("../../../src/core/utils/ReactionsCollector", () => ({
	ReactionCollectorInstance: class {
		readonly block = vi.fn().mockReturnThis();

		constructor(
			public reactionCollector: unknown,
			_context: unknown,
			public collectorOptions: { allowedPlayerKeycloakIds: string[] },
			public endCallback: (collector: unknown, response: unknown[]) => Promise<void>
		) {
			doubles.collectors.push(this);
		}

		build(): { collector: true } {
			return { collector: true };
		}
	}
}));

import {
	completeMissionsBigEvent, doRandomBigEvent
} from "../../../src/core/report/ReportBigEventService";
import {
	Player, Players
} from "../../../src/core/database/game/models/Player";
import {
	PlayerMissionsInfo, PlayerMissionsInfos
} from "../../../src/core/database/game/models/PlayerMissionsInfo";
import {
	BigEvent, BigEventDataController
} from "../../../src/data/BigEvent";
import { MapLinkDataController } from "../../../src/data/MapLink";
import { MissionsController } from "../../../src/core/missions/MissionsController";
import { chooseDestination } from "../../../src/core/report/ReportDestinationService";
import { startBigEventFight } from "../../../src/core/report/ReportBigEventFightService";
import { applyPossibilityOutcome } from "../../../src/data/events/PossibilityOutcome";
import { verifyPossibilityOutcomeCondition } from "../../../src/data/events/PossibilityOutcomeCondition";
import {
	LockedRowNotFoundError, withLockedEntities
} from "../../../../Lib/src/locks/withLockedEntities";
import { TravelTime } from "../../../src/core/maps/TravelTime";
import { Maps } from "../../../src/core/maps/Maps";
import { BlockingUtils } from "../../../src/core/utils/BlockingUtils";
import { PacketUtils } from "../../../src/core/utils/PacketUtils";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { ReportConstants } from "../../../../Lib/src/constants/ReportConstants";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { CommandReportBigEventResultRes } from "../../../../Lib/src/packets/commands/CommandReportPacket";
import { ReactionCollectorBigEvent } from "../../../../Lib/src/packets/interaction/ReactionCollectorBigEvent";
import {
	CrowniclesPacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { MapLink } from "../../../src/data/MapLink";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";
import { asPlayer } from "../ModelStubs";

const context = { keycloakId: "explorer" } as PacketContext;
const MINUTE = 60_000;

interface ExplorerRow {
	id: number;
	keycloakId: string;
	mapLinkId: number;
	nextEvent: number | null;
	getCurrentTripDuration: () => number;
	getDestinationId: () => number;
	save: ReturnType<typeof vi.fn>;
	killIfNeeded: ReturnType<typeof vi.fn>;
	runWithTokenCapReference: ReturnType<typeof vi.fn>;
}

function explorerRow(overrides: Partial<ExplorerRow> = {}): ExplorerRow {
	return {
		id: 9,
		keycloakId: "explorer",
		mapLinkId: firstMapLink().id,
		nextEvent: null,
		getCurrentTripDuration: () => 7,
		getDestinationId: () => 33,
		save: vi.fn().mockResolvedValue(undefined),
		killIfNeeded: vi.fn().mockResolvedValue(false),
		runWithTokenCapReference: vi.fn((body: () => Promise<unknown>) => body()),
		...overrides
	};
}

function firstMapLink(): MapLink {
	const mapLink = MapLinkDataController.instance.getById(1);
	if (!mapLink) {
		throw new Error("Missing map link 1");
	}
	return mapLink;
}

type OutcomeDouble = {
	condition?: object; tags?: string[]; forceLeaveCity?: boolean; forceStayInCity?: boolean; fight?: { monster: string; level: number };
};

function bigEvent(id: number, possibilities: Record<string, { outcomes: Record<string, OutcomeDouble>; tags?: string[] }>, tags?: string[]): BigEvent {
	return {
		id,
		tags,
		getPossibilities: () => Promise.resolve(Object.entries(possibilities))
	} as unknown as BigEvent; // Only the fields read by the report, the data class needs a resource file
}

let row: ExplorerRow;
let lockedRow: ExplorerRow;

async function startBigEvent(event: BigEvent, forceSpecificEvent?: number): Promise<CrowniclesPacket[]> {
	vi.spyOn(BigEventDataController.instance, "getRandomEvent").mockResolvedValue(event);
	const response: CrowniclesPacket[] = [];
	await doRandomBigEvent(context, response, asPlayer(row), forceSpecificEvent);
	return response;
}

async function choose(reactionName: string | null): Promise<CrowniclesPacket[]> {
	const response: CrowniclesPacket[] = [];
	await doubles.collectors[doubles.collectors.length - 1].endCallback({
		getFirstReaction: () => (reactionName === null ? null : { reaction: { data: { name: reactionName } } })
	}, response);
	return response;
}

beforeEach(() => {
	doubles.collectors.length = 0;
	row = explorerRow();
	lockedRow = explorerRow({ nextEvent: 12 });
	vi.spyOn(TravelTime, "getTravelDataSimplified").mockReturnValue({ playerTravelledTime: 30 * MINUTE } as ReturnType<typeof TravelTime.getTravelDataSimplified>);
	vi.spyOn(Maps, "stopTravel").mockResolvedValue(undefined);
	vi.spyOn(Players, "getOrRegister").mockImplementation(() => Promise.resolve(asPlayer(row)));
	vi.spyOn(PlayerMissionsInfos, "getOfPlayer").mockResolvedValue({} as PlayerMissionsInfo);
	vi.spyOn(BlockingUtils, "unblockPlayer").mockReturnValue(undefined);
	vi.spyOn(PacketUtils, "pushInternalError").mockReturnValue(undefined);
	vi.mocked(withLockedEntities).mockImplementation((_keys, body) => body([lockedRow] as never));
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.mocked(MissionsController.update).mockClear();
	vi.mocked(chooseDestination).mockReset().mockResolvedValue(undefined);
	vi.mocked(applyPossibilityOutcome).mockReset().mockResolvedValue(null);
	vi.mocked(verifyPossibilityOutcomeCondition).mockReset().mockResolvedValue(true);
	vi.mocked(withLockedEntities).mockReset();
	vi.mocked(startBigEventFight).mockClear();
	doubles.logBigEvent.mockClear();
});

describe("completeMissionsBigEvent", () => {
	it("should count the trip and the place reached for the travel missions", async () => {
		const response: CrowniclesPacket[] = [];
		const endMap = firstMapLink().endMap;

		await completeMissionsBigEvent(asPlayer(row), response);

		expect(vi.mocked(MissionsController.update).mock.calls).toEqual([
			[row, response, {
				missionId: "travelHours", params: { travelTime: 7 }
			}],
			[row, response, {
				missionId: "goToPlace", params: { mapId: endMap }
			}],
			[row, response, {
				missionId: "exploreDifferentPlaces", params: { placeId: endMap }
			}],
			[row, response, {
				missionId: "fromPlaceToPlace", params: { mapId: endMap }
			}]
		]);
	});
});

describe("doRandomBigEvent", () => {
	const event = bigEvent(5, {
		north: { outcomes: { 1: {} } },
		end: { outcomes: { 1: {} } }
	});

	it("should offer the possibilities of a random event of the destination to the player only, blocking it", async () => {
		const response = await startBigEvent(event);

		expect(BigEventDataController.instance.getRandomEvent).toHaveBeenCalledWith(33, row);
		expect(Maps.stopTravel).toHaveBeenCalledWith(row);
		expect(response[response.length - 1]).toEqual({ collector: true });
		const [collector] = doubles.collectors;
		expect(collector.reactionCollector).toEqual(new ReactionCollectorBigEvent(5, [{ name: "north" }, { name: "end" }]));
		expect(collector.collectorOptions).toEqual({ allowedPlayerKeycloakIds: ["explorer"] });
		expect(collector.block).toHaveBeenCalledWith("explorer", BlockingConstants.REASONS.REPORT);
	});

	it("should report a destination without big event and leave the player travelling", async () => {
		vi.spyOn(BigEventDataController.instance, "getRandomEvent").mockResolvedValue(null);
		const response: CrowniclesPacket[] = [];

		await doRandomBigEvent(context, response, asPlayer(row));

		expect(PacketUtils.pushInternalError).toHaveBeenCalledWith(response, "No big event available on map 33", { context: { keycloakId: "explorer" } });
		expect(Maps.stopTravel).not.toHaveBeenCalled();
		expect(doubles.collectors).toHaveLength(0);
	});

	it("should play the event planned for the player, or the forced one, instead of a random one", async () => {
		const planned = BigEventDataController.instance.getById(1);
		row.nextEvent = 1;

		await startBigEvent(event);
		expect(doubles.collectors[0].reactionCollector).toMatchObject({ eventId: planned?.id });

		row.nextEvent = null;
		await startBigEvent(event, 1);
		expect(doubles.collectors[1].reactionCollector).toMatchObject({ eventId: 1 });
		expect(BigEventDataController.instance.getRandomEvent).not.toHaveBeenCalled();
	});

	it("should pick a random event when the forced event is 0", async () => {
		await startBigEvent(event, 0);

		expect(BigEventDataController.instance.getRandomEvent).toHaveBeenCalled();
	});

	describe("outcome", () => {
		const timeOf = (): number => vi.mocked(applyPossibilityOutcome).mock.calls[0][0].time;

		it("should apply a random valid outcome of the chosen possibility under the player and missions lock", async () => {
			const tagged = bigEvent(5, {
				north: {
					outcomes: {
						a: { tags: ["outcomeTag"] }, b: { condition: { level: 1 } }
					},
					tags: ["possibilityTag"]
				},
				end: { outcomes: { 1: {} } }
			}, ["eventTag"]);
			vi.mocked(verifyPossibilityOutcomeCondition).mockResolvedValue(false);
			const pick = vi.spyOn(RandomUtils.crowniclesRandom, "pick");
			await startBigEvent(tagged);

			const response = await choose("north");

			expect(verifyPossibilityOutcomeCondition).toHaveBeenCalledWith({ level: 1 }, row);
			expect(pick).toHaveBeenCalledWith([["a", { tags: ["outcomeTag"] }]]);
			expect(PlayerMissionsInfos.getOfPlayer).toHaveBeenCalledWith(row.id);
			expect(withLockedEntities).toHaveBeenCalledWith([Player.lockKey(row.id), PlayerMissionsInfo.lockKey(row.id)], expect.any(Function));
			expect(lockedRow.runWithTokenCapReference).toHaveBeenCalledOnce();
			expect(lockedRow.nextEvent).toBeNull();
			expect(lockedRow.save).toHaveBeenCalledTimes(2);
			expect(applyPossibilityOutcome).toHaveBeenCalledWith({
				eventId: 5, possibilityName: "north", outcome: ["a", { tags: ["outcomeTag"] }], time: 30
			}, lockedRow, context, response);
			expect(lockedRow.killIfNeeded).toHaveBeenCalledWith(response, NumberChangeReason.BIG_EVENT);
			expect(chooseDestination).toHaveBeenCalledWith(context, lockedRow, null, response, {
				mainPacket: false, allowStayInCity: true, forceStayInCity: false
			});
			const tags = ["outcomeTag", "possibilityTag", "eventTag"];
			expect(vi.mocked(MissionsController.update).mock.calls.slice(-4)).toEqual([
				[lockedRow, response, { missionId: "doReports" }],
				...tags.map(tag => [lockedRow, response, {
					missionId: tag, params: { tags }
				}])
			]);
			expect(doubles.logBigEvent).toHaveBeenCalledWith("explorer", 5, "north", "a");
			expect(BlockingUtils.unblockPlayer).toHaveBeenCalledWith("explorer", BlockingConstants.REASONS.REPORT);
		});

		it("should play the end possibility when the player does not choose", async () => {
			await startBigEvent(event);

			await choose(null);

			expect(vi.mocked(applyPossibilityOutcome).mock.calls[0][0].possibilityName).toBe("end");
			// Without any tag, the report only counts for the reports mission
			expect(vi.mocked(MissionsController.update).mock.calls.slice(4).map(call => call[2].missionId)).toEqual(["doReports"]);
		});

		it("should cap the time travelled taken into account", async () => {
			vi.mocked(TravelTime.getTravelDataSimplified).mockReturnValue({ playerTravelledTime: (ReportConstants.TIME_LIMIT + 50) * MINUTE } as ReturnType<typeof TravelTime.getTravelDataSimplified>);
			await startBigEvent(event);

			await choose("north");

			expect(timeOf()).toBe(ReportConstants.TIME_LIMIT);
		});

		it("should honor the city constraints of the outcome", async () => {
			await startBigEvent(bigEvent(5, { north: { outcomes: { 1: {
				forceLeaveCity: true, forceStayInCity: true
			} } } }));

			await choose("north");

			expect(chooseDestination).toHaveBeenCalledWith(context, lockedRow, null, expect.any(Array), {
				mainPacket: false, allowStayInCity: false, forceStayInCity: true
			});
		});

		it("should not choose a destination for a dead player, unless the outcome teleports it", async () => {
			lockedRow.killIfNeeded.mockResolvedValue(true);
			await startBigEvent(event);
			await choose("north");
			expect(chooseDestination).not.toHaveBeenCalled();

			const teleport = { id: 4 } as MapLink;
			vi.mocked(applyPossibilityOutcome).mockResolvedValue(teleport);
			await choose("north");
			expect(chooseDestination).toHaveBeenCalledWith(context, lockedRow, teleport, expect.any(Array), expect.anything());
		});

		it("should start the fight of the outcome after the lock and choose the destination only once it is over", async () => {
			const fight = { monster: "bandit", level: 40 };
			const freshRow = asPlayer(explorerRow());
			vi.spyOn(Players, "getById").mockResolvedValue(freshRow);
			await startBigEvent(bigEvent(5, { north: { outcomes: { 1: { fight, forceLeaveCity: true } } } }));

			const response = await choose("north");

			expect(chooseDestination).not.toHaveBeenCalled();
			expect(lockedRow.save).toHaveBeenCalledTimes(2);
			expect(doubles.logBigEvent).toHaveBeenCalledWith("explorer", 5, "north", "1");
			expect(startBigEventFight).toHaveBeenCalledWith(freshRow, {
				eventId: 5,
				possibilityId: "north",
				outcomeId: "1",
				fight,
				destination: { newMapLink: null, allowStayInCity: false, forceStayInCity: false }
			}, context, response);
			expect(vi.mocked(startBigEventFight).mock.invocationCallOrder[0])
				.toBeLessThan(vi.mocked(BlockingUtils.unblockPlayer).mock.invocationCallOrder[0]);
		});

		it("should not start the fight of a player the outcome killed", async () => {
			lockedRow.killIfNeeded.mockResolvedValue(true);
			await startBigEvent(bigEvent(5, { north: { outcomes: { 1: { fight: { monster: "bandit", level: 40 } } } } }));

			await choose("north");

			expect(startBigEventFight).not.toHaveBeenCalled();
		});

		it("should only acknowledge the end of the very first report", async () => {
			await startBigEvent(bigEvent(ReportConstants.FIRST_BIG_EVENT_ID, { end: { outcomes: { 1: {} } } }));

			const response = await choose(ReportConstants.END_POSSIBILITY_ID);

			expect(response).toEqual([expect.any(CommandReportBigEventResultRes)]);
			expect(response[0]).toMatchObject({
				...ReportConstants.EMPTY_BIG_EVENT_RESULT,
				eventId: ReportConstants.FIRST_BIG_EVENT_ID,
				possibilityId: ReportConstants.END_POSSIBILITY_ID
			});
			expect(doubles.logBigEvent).toHaveBeenCalledWith("explorer", ReportConstants.FIRST_BIG_EVENT_ID, ReportConstants.END_POSSIBILITY_ID, "0");
			expect(withLockedEntities).not.toHaveBeenCalled();
			expect(applyPossibilityOutcome).not.toHaveBeenCalled();
			expect(BlockingUtils.unblockPlayer).toHaveBeenCalledWith("explorer", BlockingConstants.REASONS.REPORT);
		});

		it("should play the other choices of the first report", async () => {
			await startBigEvent(bigEvent(ReportConstants.FIRST_BIG_EVENT_ID, { north: { outcomes: { 1: {} } } }));

			await choose("north");

			expect(applyPossibilityOutcome).toHaveBeenCalled();
		});

		it("should play the end of any other event", async () => {
			await startBigEvent(event);

			await choose(ReportConstants.END_POSSIBILITY_ID);

			expect(vi.mocked(applyPossibilityOutcome).mock.calls[0][0].possibilityName).toBe(ReportConstants.END_POSSIBILITY_ID);
		});

		it("should move the player on when its row vanished, even if that fails too", async () => {
			const fallback = asPlayer(explorerRow());
			const warn = vi.spyOn(CrowniclesLogger, "warn").mockReturnValue(undefined);
			vi.spyOn(Players, "getById").mockResolvedValue(fallback);
			vi.mocked(withLockedEntities).mockRejectedValue(new LockedRowNotFoundError("players", row.id));
			await startBigEvent(event);

			const response = await choose("north");

			expect(chooseDestination).toHaveBeenCalledWith(context, fallback, null, response, { mainPacket: false });
			expect(BlockingUtils.unblockPlayer).toHaveBeenCalledWith("explorer", BlockingConstants.REASONS.REPORT);

			vi.mocked(chooseDestination).mockRejectedValue(new Error("no destination"));
			await expect(choose("north")).resolves.toEqual([]);
			expect(warn).toHaveBeenLastCalledWith(`doPossibility: fallback chooseDestination failed for player ${row.id}: no destination`);
		});

		it("should not swallow an unexpected error", async () => {
			vi.mocked(withLockedEntities).mockRejectedValue(new Error("database down"));
			await startBigEvent(event);

			await expect(choose("north")).rejects.toThrow("database down");
			expect(BlockingUtils.unblockPlayer).not.toHaveBeenCalled();
		});
	});
});
