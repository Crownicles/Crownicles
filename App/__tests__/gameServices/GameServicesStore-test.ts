import {GameServicesStore, gameProgressKey} from "@/src/gameServices/GameServicesStore";
import {GAME_ACHIEVEMENTS} from "@/src/gameServices/Achievements";
import {GAME_SERVICE_AVAILABILITY, GAME_SERVICE_PROVIDERS, GAME_SERVICE_SCOPES, GamePlatformPlayer} from "@/src/gameServices/GameServicesTypes";
import {TopRes} from "ws-packets/src/fromServer/fight/RankingsRes";
import {TopDataType, TopTiming} from "ws-packets/src/objects/Rankings";
import type {FightEnd} from "ws-packets/src/objects/Fight";

const PLAYER: GamePlatformPlayer = {id: "platform-player", displayName: "Joueur"};
const END: FightEnd = {winner: {isSelf: true, finalEnergy: 100, maxEnergy: 200}, loser: {isSelf: false, finalEnergy: 0, maxEnergy: 200}, draw: false, turns: 3, maxTurns: 30};

function ranking(score: number): TopRes {
	return Object.assign(new TopRes(), {
		dataType: TopDataType.SCORE, timing: TopTiming.WEEK, canBeRanked: true,
		elements: [{rank: 1, sameContext: false, name: "Autre joueur", value: 99999, level: 10}, {rank: 2, sameContext: true, name: "Personnage", value: score, level: 10}],
		totalElements: 2, elementsPerPage: 15, pageNumber: 1
	});
}

function harness() {
	const persisted = new Map<string, string>();
	const storage = {
		getItem: jest.fn((key: string): Promise<string | null> => Promise.resolve(persisted.get(key) ?? null)),
		setItem: jest.fn((key: string, value: string): Promise<void> => {persisted.set(key, value); return Promise.resolve();})
	};
	const platform = {
		provider: GAME_SERVICE_PROVIDERS.GAME_CENTER,
		availability: GAME_SERVICE_AVAILABILITY.AVAILABLE,
		getPlayer: jest.fn((): Promise<GamePlatformPlayer | null> => Promise.resolve(PLAYER)),
		connect: jest.fn((): Promise<GamePlatformPlayer | null> => Promise.resolve(PLAYER)),
		unlockAchievement: jest.fn((): Promise<void> => Promise.resolve()),
		submitTopweekScore: jest.fn((): Promise<void> => Promise.resolve()),
		showAchievements: jest.fn((): Promise<void> => Promise.resolve()),
		showTopweekLeaderboard: jest.fn((): Promise<void> => Promise.resolve())
	};
	return {platform, storage, persisted, store: new GameServicesStore(platform, storage)};
}

describe("device game services progress", () => {
	let warning: jest.SpyInstance;
	beforeEach(() => {warning = jest.spyOn(console, "warn").mockImplementation();});
	afterEach(() => warning.mockRestore());

	it("persists an earned achievement before submitting and does not submit it twice", async () => {
		const {store, platform, persisted} = harness();
		platform.unlockAchievement.mockImplementation((): Promise<void> => {
			expect(JSON.parse(persisted.get(gameProgressKey(platform.provider, PLAYER.id))!).unlocked).toEqual([GAME_ACHIEVEMENTS.PVP_FIGHT_COMPLETED]);
			return Promise.resolve();
		});
		await Promise.all([store.recordFightEnd(END), store.recordFightEnd(END)]);
		expect(platform.unlockAchievement).toHaveBeenCalledTimes(1);
		expect(platform.unlockAchievement).toHaveBeenCalledWith(GAME_ACHIEVEMENTS.PVP_FIGHT_COMPLETED);
	});

	it("retries a failed submission after restarting the app", async () => {
		const {store, platform, storage} = harness();
		platform.unlockAchievement.mockRejectedValueOnce(new Error("offline"));
		await store.recordFightEnd(END);
		expect(store.getSnapshot().syncFailed).toBe(true);
		const restarted = new GameServicesStore(platform, storage);
		await restarted.refresh();
		expect(platform.unlockAchievement).toHaveBeenCalledTimes(2);
		expect(restarted.getSnapshot().syncFailed).toBe(false);
		await restarted.refresh();
		expect(platform.unlockAchievement).toHaveBeenCalledTimes(2);
	});

	it("adopts progress earned before signing into the platform", async () => {
		const {store, platform} = harness();
		platform.getPlayer.mockResolvedValue(null);
		await store.recordFightEnd(END);
		expect(platform.unlockAchievement).not.toHaveBeenCalled();
		platform.getPlayer.mockResolvedValue(PLAYER);
		await store.connect();
		expect(platform.unlockAchievement).toHaveBeenCalledTimes(1);
		await store.connect();
		expect(platform.unlockAchievement).toHaveBeenCalledTimes(1);
	});

	it("never transfers one platform profile's pending achievement to another", async () => {
		const {store, platform, persisted} = harness();
		const other = {id: "other-platform-player", displayName: "Autre personne"};
		platform.getPlayer.mockResolvedValueOnce(PLAYER).mockResolvedValue(other);
		await store.recordFightEnd(END);
		expect(platform.unlockAchievement).not.toHaveBeenCalled();
		expect(store.getSnapshot().player).toEqual(other);
		expect(JSON.parse(persisted.get(gameProgressKey(platform.provider, PLAYER.id))!).reported).toEqual([]);
		await store.refresh();
		expect(platform.unlockAchievement).not.toHaveBeenCalled();
		platform.getPlayer.mockResolvedValue(PLAYER);
		await store.refresh();
		expect(platform.unlockAchievement).toHaveBeenCalledTimes(1);
	});

	it("records the player's own topweek maximum across character changes and weekly resets", async () => {
		const {store, platform, storage} = harness();
		await store.recordRanking(ranking(400));
		await store.recordRanking(ranking(200));
		await store.recordRanking(ranking(0));
		await store.recordRanking(ranking(600));
		expect(platform.submitTopweekScore.mock.calls).toEqual([[400], [600]]);
		const restarted = new GameServicesStore(platform, storage);
		await restarted.refresh();
		expect(restarted.getSnapshot().bestTopweekScore).toBe(600);
		expect(platform.submitTopweekScore).toHaveBeenCalledTimes(2);
	});

	it("does not use all-time scores, glory, other players or invalid score values", async () => {
		const {store, platform} = harness();
		await store.recordRanking({...ranking(400), timing: TopTiming.ALL_TIME});
		await store.recordRanking({...ranking(400), dataType: TopDataType.GLORY});
		await store.recordRanking({...ranking(400), elements: ranking(400).elements.filter(entry => !entry.sameContext)});
		for (const invalid of [Number.NaN, Infinity, -1, 1.5]) await store.recordRanking(ranking(invalid));
		expect(platform.submitTopweekScore).not.toHaveBeenCalled();
	});

	it("retries the best pending score, not a lower score read after a reset", async () => {
		const {store, platform} = harness();
		platform.submitTopweekScore.mockRejectedValueOnce(new Error("offline"));
		await store.recordRanking(ranking(500));
		await store.recordRanking(ranking(10));
		expect(platform.submitTopweekScore.mock.calls).toEqual([[500], [500]]);
	});

	it("does not submit anything if durable storage fails", async () => {
		const {store, storage, platform} = harness();
		storage.setItem.mockRejectedValueOnce(new Error("storage unavailable"));
		await store.recordFightEnd(END);
		expect(platform.unlockAchievement).not.toHaveBeenCalled();
		expect(store.getSnapshot().syncFailed).toBe(true);
	});

	it("opens the two native platform views", async () => {
		const {store, platform} = harness();
		await store.showAchievements();
		await store.showTopweekLeaderboard();
		expect(platform.showAchievements).toHaveBeenCalledTimes(1);
		expect(platform.showTopweekLeaderboard).toHaveBeenCalledTimes(1);
	});

	it("persists new progress while the native achievements screen is still open", async () => {
		const {store, platform, persisted} = harness();
		let close!: () => void;
		platform.showAchievements.mockReturnValue(new Promise<void>(resolve => {close = resolve;}));
		const opened = store.showAchievements();
		await store.recordFightEnd(END);
		expect(JSON.parse(persisted.get(gameProgressKey(platform.provider, PLAYER.id))!).unlocked).toEqual([GAME_ACHIEVEMENTS.PVP_FIGHT_COMPLETED]);
		expect(platform.unlockAchievement).toHaveBeenCalledTimes(1);
		close();
		await opened;
	});

	it("keeps an event's original platform owner while an earlier operation delays it", async () => {
		const {store, platform, persisted} = harness();
		let finish!: () => void;
		platform.submitTopweekScore.mockReturnValueOnce(new Promise<void>(resolve => {finish = resolve;}));
		const submitting = store.recordRanking(ranking(100));
		await new Promise<void>(resolve => setTimeout(resolve, 0));
		const earned = store.recordFightEnd(END);
		platform.getPlayer.mockResolvedValue({id: "other-platform-player", displayName: "Autre personne"});
		finish();
		await Promise.all([submitting, earned]);
		expect(platform.unlockAchievement).not.toHaveBeenCalled();
		expect(JSON.parse(persisted.get(gameProgressKey(platform.provider, PLAYER.id))!).unlocked).toEqual([GAME_ACHIEVEMENTS.PVP_FIGHT_COMPLETED]);
		platform.getPlayer.mockResolvedValue(PLAYER);
		await store.refresh();
		expect(platform.unlockAchievement).toHaveBeenCalledTimes(1);
	});

	it("does not replay local pending progress into production for the same platform profile", async () => {
		const {platform, storage} = harness();
		const local = new GameServicesStore({...platform, storageScope: GAME_SERVICE_SCOPES.LOCAL}, storage);
		platform.unlockAchievement.mockRejectedValueOnce(new Error("local test unavailable"));
		await local.recordFightEnd(END);
		platform.submitTopweekScore.mockRejectedValueOnce(new Error("local test unavailable"));
		await local.recordRanking(ranking(90000));
		platform.unlockAchievement.mockClear();
		platform.submitTopweekScore.mockClear();
		const production = new GameServicesStore({...platform, storageScope: GAME_SERVICE_SCOPES.PRODUCTION}, storage);
		await production.refresh();
		expect(production.getSnapshot().bestTopweekScore).toBe(0);
		expect(platform.unlockAchievement).not.toHaveBeenCalled();
		expect(platform.submitTopweekScore).not.toHaveBeenCalled();
		await production.recordRanking(ranking(100));
		expect(platform.submitTopweekScore).toHaveBeenCalledWith(100);
		expect(local.getSnapshot().bestTopweekScore).toBe(90000);
	});

	it("does not adopt unscoped historical data into either new iPhone scope", async () => {
		const {platform, storage, persisted} = harness();
		const previous = JSON.stringify({unlocked: [GAME_ACHIEVEMENTS.PVP_FIGHT_COMPLETED], reported: [], bestTopweekScore: 99999, reportedTopweekScore: 0});
		persisted.set(gameProgressKey(platform.provider, PLAYER.id), previous);
		persisted.set(gameProgressKey(platform.provider, "unassigned"), previous);
		for (const storageScope of Object.values(GAME_SERVICE_SCOPES)) {
			const scoped = new GameServicesStore({...platform, storageScope}, storage);
			await scoped.refresh();
			expect(scoped.getSnapshot().bestTopweekScore).toBe(0);
		}
		expect(platform.unlockAchievement).not.toHaveBeenCalled();
		expect(platform.submitTopweekScore).not.toHaveBeenCalled();
	});

	it("can reset local acknowledgements to repeat a test without resetting production progress", async () => {
		const {platform, storage} = harness();
		const local = new GameServicesStore({...platform, storageScope: GAME_SERVICE_SCOPES.LOCAL}, storage);
		const production = new GameServicesStore({...platform, storageScope: GAME_SERVICE_SCOPES.PRODUCTION}, storage);
		await local.recordRanking(ranking(90000));
		await local.recordFightEnd(END);
		await production.recordRanking(ranking(500));
		await local.resetLocalProgress();
		expect(local.getSnapshot().bestTopweekScore).toBe(0);
		await production.refresh();
		expect(production.getSnapshot().bestTopweekScore).toBe(500);
		await production.resetLocalProgress();
		expect(production.getSnapshot().bestTopweekScore).toBe(500);
		platform.unlockAchievement.mockClear();
		await local.recordFightEnd(END);
		expect(platform.unlockAchievement).toHaveBeenCalledTimes(1);
	});

	it("does not accumulate iPhone progress when its Game Center profile is disabled or incorrectly launched", async () => {
		const {platform, storage, persisted} = harness();
		for (const storageScope of Object.values(GAME_SERVICE_SCOPES)) {
			const disabled = new GameServicesStore({...platform, storageScope, availability: GAME_SERVICE_AVAILABILITY.NOT_CONFIGURED}, storage);
			await disabled.recordFightEnd(END);
			await disabled.recordRanking(ranking(99999));
		}
		expect(persisted.size).toBe(0);
		expect(platform.unlockAchievement).not.toHaveBeenCalled();
		expect(platform.submitTopweekScore).not.toHaveBeenCalled();
	});
});