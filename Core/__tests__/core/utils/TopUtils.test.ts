import {
	describe, it, expect, beforeEach, afterEach, vi
} from "vitest";
import {
	getTopKind, NO_GUILD_ID, TopKind, TopStorage
} from "../../../src/core/utils/TopUtils";
import { TopDataType } from "../../../../Lib/src/types/TopDataType";
import { TopTiming } from "../../../../Lib/src/types/TopTimings";
import { TopConstants } from "../../../../Lib/src/constants/TopConstants";
import { Players } from "../../../src/core/database/game/models/Player";
import { Guilds } from "../../../src/core/database/game/models/Guild";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- needed to inject test data into private fields
function getStorageInternals(storage: TopStorage): any {
	return storage;
}

function markFresh(storage: TopStorage, kind: TopKind): void {
	getStorageInternals(storage)._lastUpdated.set(kind, Date.now());
}

function markStale(storage: TopStorage, kind: TopKind): void {
	// Epoch is always older than the stale threshold, so the next askTop triggers a refresh
	getStorageInternals(storage)._lastUpdated.set(kind, 0);
}

function injectScoreTop(storage: TopStorage, count: number, weekly: boolean): void {
	const internals = getStorageInternals(storage);
	const kind = weekly ? TopKind.SCORE_WEEKLY : TopKind.SCORE_ALL_TIME;
	internals._tops[kind] = {
		totalElements: count,
		timing: weekly ? TopTiming.WEEK : TopTiming.ALL_TIME,
		elements: Array.from({ length: count }, (_, i) => ({
			id: i + 1,
			rank: i + 1,
			sameContext: false,
			text: `player-${i + 1}`,
			attributes: {
				1: {
					effectId: undefined,
					mapType: undefined,
					afk: false
				},
				2: (count - i) * 100,
				3: 50 - i
			}
		}))
	};
	markFresh(storage, kind);
}

function injectGloryTop(storage: TopStorage, count: number): void {
	const internals = getStorageInternals(storage);
	internals._tops[TopKind.GLORY] = {
		totalElements: count,
		timing: TopTiming.WEEK,
		elements: Array.from({ length: count }, (_, i) => ({
			id: i + 1,
			rank: i + 1,
			sameContext: false,
			text: `player-${i + 1}`,
			attributes: {
				1: i % 5,
				2: (count - i) * 10,
				3: 40 - i
			}
		}))
	};
	markFresh(storage, TopKind.GLORY);
}

function injectGuildTop(storage: TopStorage, count: number): void {
	const internals = getStorageInternals(storage);
	internals._tops[TopKind.GUILDS] = {
		totalElements: count,
		timing: TopTiming.ALL_TIME,
		elements: Array.from({ length: count }, (_, i) => ({
			id: i + 100,
			rank: i + 1,
			sameContext: false,
			text: `guild-${i + 1}`,
			attributes: {
				1: (count - i) * 50,
				2: 10 - i,
				3: undefined
			}
		}))
	};
	markFresh(storage, TopKind.GUILDS);
}

describe("getTopKind", () => {
	it("should return SCORE_ALL_TIME for score + all time", () => {
		expect(getTopKind(TopDataType.SCORE, TopTiming.ALL_TIME)).toBe(TopKind.SCORE_ALL_TIME);
	});

	it("should return SCORE_WEEKLY for score + week", () => {
		expect(getTopKind(TopDataType.SCORE, TopTiming.WEEK)).toBe(TopKind.SCORE_WEEKLY);
	});

	it("should return GLORY for glory data type", () => {
		expect(getTopKind(TopDataType.GLORY, TopTiming.ALL_TIME)).toBe(TopKind.GLORY);
		expect(getTopKind(TopDataType.GLORY, TopTiming.WEEK)).toBe(TopKind.GLORY);
	});

	it("should return GUILDS for guild data type", () => {
		expect(getTopKind(TopDataType.GUILD, TopTiming.ALL_TIME)).toBe(TopKind.GUILDS);
	});
});

describe("TopStorage.askTop", () => {
	let storage: TopStorage;

	beforeEach(() => {
		// Reset singleton
		// eslint-disable-next-line @typescript-eslint/no-explicit-any -- reset singleton for test isolation
		(TopStorage as any)._instance = undefined;
		storage = TopStorage.getInstance();
	});

	describe("with 0 elements", () => {
		beforeEach(() => {
			// Mark all kinds as fresh so askTop doesn't try to refresh from DB
			for (const kind of Object.values(TopKind)) {
				markFresh(storage, kind);
			}
		});

		it("should return NO_ELEMENT for empty score top", async () => {
			const result = await storage.askTop(TopKind.SCORE_ALL_TIME, 1);
			expect(result.result).toBe(1); // NO_ELEMENT
			expect(result.kind).toBe(TopKind.SCORE_ALL_TIME);
		});

		it("should include needFight for empty glory top", async () => {
			const result = await storage.askTop(TopKind.GLORY, 1, 3);
			expect(result.result).toBe(1); // NO_ELEMENT
			expect(result.data).toHaveProperty("needFight", 3);
		});

		it("should not include needFight for empty guild top", async () => {
			const result = await storage.askTop(TopKind.GUILDS, 1);
			expect(result.result).toBe(1); // NO_ELEMENT
			expect(result.data).not.toHaveProperty("needFight");
		});
	});

	describe("with populated score top", () => {
		beforeEach(() => {
			injectScoreTop(storage, 30, false);
		});

		it("should return OK with a single page of elements", async () => {
			const result = await storage.askTop(TopKind.SCORE_ALL_TIME, 1);
			expect(result.result).toBe(0); // OK
			if ("data" in result && "elements" in result.data) {
				expect(result.data.elements).toHaveLength(TopConstants.PLAYERS_PER_PAGE);
				expect(result.data.totalElements).toBe(30);
				expect(result.data.elementsPerPage).toBe(TopConstants.PLAYERS_PER_PAGE);
				expect(result.data.pageNumber).toBe(1);
			}
		});

		it("should find contextRank for existing player", async () => {
			const result = await storage.askTop(TopKind.SCORE_ALL_TIME, 5);
			if ("data" in result && "contextRank" in result.data) {
				expect(result.data.contextRank).toBe(5);
			}
		});

		it("should not have contextRank for unknown player", async () => {
			const result = await storage.askTop(TopKind.SCORE_ALL_TIME, 999);
			if ("data" in result && "elements" in result.data) {
				expect(result.data.contextRank).toBeUndefined();
			}
		});

		it("should set sameContext for the requesting player's elements", async () => {
			const result = await storage.askTop(TopKind.SCORE_ALL_TIME, 3);
			if ("data" in result && "elements" in result.data) {
				const selfElement = result.data.elements.find(e => e.rank === 3);
				expect(selfElement?.sameContext).toBe(true);
				const otherElement = result.data.elements.find(e => e.rank === 1);
				expect(otherElement?.sameContext).toBe(false);
			}
		});

		it("should return the requested page window", async () => {
			const result = await storage.askTop(TopKind.SCORE_ALL_TIME, 1, undefined, 2);
			if ("data" in result && "elements" in result.data) {
				expect(result.data.pageNumber).toBe(2);
				// Page 2 contains ranks 16..30
				expect(result.data.elements).toHaveLength(30 - TopConstants.PLAYERS_PER_PAGE);
				expect(result.data.elements[0].rank).toBe(TopConstants.PLAYERS_PER_PAGE + 1);
			}
		});

		it("should fall back to the contextRank page when no page is requested", async () => {
			// Player at rank 20 -> page 2 (ranks 16..30)
			const result = await storage.askTop(TopKind.SCORE_ALL_TIME, 20);
			if ("data" in result && "elements" in result.data) {
				expect(result.data.pageNumber).toBe(2);
				expect(result.data.contextRank).toBe(20);
				expect(result.data.elements.some(e => e.rank === 20)).toBe(true);
			}
		});

		it("should fall back to page 1 when the requested page is out of range", async () => {
			const result = await storage.askTop(TopKind.SCORE_ALL_TIME, 999, undefined, 999);
			if ("data" in result && "elements" in result.data) {
				expect(result.data.pageNumber).toBe(1);
				expect(result.data.elements[0].rank).toBe(1);
			}
		});

		it("should cache position on second call", async () => {
			await storage.askTop(TopKind.SCORE_ALL_TIME, 5);
			// Second call should use cache
			const result = await storage.askTop(TopKind.SCORE_ALL_TIME, 5);
			if ("data" in result && "elements" in result.data) {
				expect(result.data.contextRank).toBe(5);
			}
		});

		it("should always set canBeRanked to true for score top", async () => {
			const result = await storage.askTop(TopKind.SCORE_ALL_TIME, 999);
			if ("data" in result && "elements" in result.data) {
				expect(result.data.canBeRanked).toBe(true);
			}
		});
	});

	describe("with populated glory top", () => {
		beforeEach(() => {
			injectGloryTop(storage, 20);
		});

		it("should set rank to -1 when needFight > 0", async () => {
			const result = await storage.askTop(TopKind.GLORY, 5, 3);
			if ("data" in result && "elements" in result.data) {
				// Player 5 exists but has needFight > 0 -> not ranked
				expect(result.data.contextRank).toBeUndefined();
			}
		});

		it("should find rank when needFight <= 0", async () => {
			const result = await storage.askTop(TopKind.GLORY, 5, -2);
			if ("data" in result && "elements" in result.data) {
				expect(result.data.contextRank).toBe(5);
			}
		});

		it("should find rank when needFight is 0", async () => {
			const result = await storage.askTop(TopKind.GLORY, 5, 0);
			if ("data" in result && "elements" in result.data) {
				expect(result.data.contextRank).toBe(5);
			}
		});
	});

	describe("with populated guild top", () => {
		beforeEach(() => {
			injectGuildTop(storage, 10);
		});

		it("should set canBeRanked to false when id is NO_GUILD_ID", async () => {
			const result = await storage.askTop(TopKind.GUILDS, NO_GUILD_ID);
			if ("data" in result && "elements" in result.data) {
				expect(result.data.canBeRanked).toBe(false);
			}
		});

		it("should set canBeRanked to true when player has a guild", async () => {
			const result = await storage.askTop(TopKind.GUILDS, 100);
			if ("data" in result && "elements" in result.data) {
				expect(result.data.canBeRanked).toBe(true);
				expect(result.data.contextRank).toBe(1);
			}
		});

		it("should use GUILDS_PER_PAGE for guilds", async () => {
			const result = await storage.askTop(TopKind.GUILDS, 100);
			if ("data" in result && "elements" in result.data) {
				expect(result.data.elementsPerPage).toBe(TopConstants.GUILDS_PER_PAGE);
			}
		});

		it("should not find context rank for player without guild in top", async () => {
			const result = await storage.askTop(TopKind.GUILDS, 999);
			if ("data" in result && "elements" in result.data) {
				expect(result.data.contextRank).toBeUndefined();
				expect(result.data.canBeRanked).toBe(true);
			}
		});
	});
});

/**
 * Performance / non-regression guarantees of the cache.
 *
 * The /top pipeline relies on a server-side snapshot refreshed at most once per stale window.
 * These tests pin the two properties that protect production performance:
 *  - a warm cache never hits the database;
 *  - concurrent requests on a stale kind collapse into a single refresh (no thundering herd).
 *
 * The heavy DB calls are stubbed so the refresh is observable through call counts only.
 */
describe("TopStorage cache performance guarantees", () => {
	let storage: TopStorage;
	let countSpy: ReturnType<typeof vi.spyOn>;
	let topSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any -- reset singleton for test isolation
		(TopStorage as any)._instance = undefined;
		storage = TopStorage.getInstance();
		// A refresh of a score kind always starts by counting players; stub it (and the row fetch) to avoid DB access
		countSpy = vi.spyOn(Players, "getNumberOfPlayingPlayers").mockResolvedValue(0);
		topSpy = vi.spyOn(Players, "getPlayersTop").mockResolvedValue([]);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should not hit the database when the cached snapshot is fresh", async () => {
		injectScoreTop(storage, 30, false); // injects data and marks the kind fresh

		await storage.askTop(TopKind.SCORE_ALL_TIME, 1);
		await storage.askTop(TopKind.SCORE_ALL_TIME, 2);
		await storage.askTop(TopKind.SCORE_ALL_TIME, 3);

		expect(countSpy).not.toHaveBeenCalled();
		expect(topSpy).not.toHaveBeenCalled();
	});

	it("should refresh from the database when the snapshot is stale", async () => {
		markStale(storage, TopKind.SCORE_ALL_TIME);

		await storage.askTop(TopKind.SCORE_ALL_TIME, 1);

		expect(countSpy).toHaveBeenCalledTimes(1);
	});

	it("should collapse concurrent stale requests into a single refresh", async () => {
		markStale(storage, TopKind.SCORE_ALL_TIME);

		await Promise.all([
			storage.askTop(TopKind.SCORE_ALL_TIME, 1),
			storage.askTop(TopKind.SCORE_ALL_TIME, 2),
			storage.askTop(TopKind.SCORE_ALL_TIME, 3),
			storage.askTop(TopKind.SCORE_ALL_TIME, 4),
			storage.askTop(TopKind.SCORE_ALL_TIME, 5)
		]);

		// Five simultaneous callers must trigger exactly one database refresh, not five
		expect(countSpy).toHaveBeenCalledTimes(1);
	});

	it("should refresh again once the in-flight refresh has settled and the snapshot is stale anew", async () => {
		markStale(storage, TopKind.SCORE_ALL_TIME);
		await storage.askTop(TopKind.SCORE_ALL_TIME, 1);
		expect(countSpy).toHaveBeenCalledTimes(1);

		// A later stale window must allow a fresh refresh (the in-flight guard does not block forever)
		markStale(storage, TopKind.SCORE_ALL_TIME);
		await storage.askTop(TopKind.SCORE_ALL_TIME, 1);
		expect(countSpy).toHaveBeenCalledTimes(2);
	});

	it("should refresh each kind independently through updateTops without redundant work", async () => {
		// updateTops refreshes every kind, so stub the glory and guild data sources too
		const fightingSpy = vi.spyOn(Players, "getNumberOfFightingPlayers").mockResolvedValue(0);
		vi.spyOn(Players, "getPlayersGloryTop").mockResolvedValue([]);
		const guildCountSpy = vi.spyOn(Guilds, "getTotalRanked").mockResolvedValue(0);
		vi.spyOn(Guilds, "getRankedGuilds").mockResolvedValue([]);
		// updateTops logs on completion; the logger is not initialized in unit tests, so stub it
		vi.spyOn(CrowniclesLogger, "info").mockImplementation(() => {});

		await storage.updateTops();

		// Each kind is refreshed exactly once: two score kinds, one glory, one guild
		expect(countSpy).toHaveBeenCalledTimes(2);
		expect(fightingSpy).toHaveBeenCalledTimes(1);
		expect(guildCountSpy).toHaveBeenCalledTimes(1);
	});
});

