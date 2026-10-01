import type AsyncStorage from "@react-native-async-storage/async-storage";
import type {FightEnd} from "ws-packets/src/objects/Fight";
import type {TopRes} from "ws-packets/src/fromServer/fight/RankingsRes";
import {TopDataType, TopTiming} from "ws-packets/src/objects/Rankings";
import {achievementsForFightEnd, GAME_ACHIEVEMENTS, GameAchievementId} from "./Achievements";
import {GAME_SERVICE_AVAILABILITY, GAME_SERVICE_PROVIDERS, GAME_SERVICE_SCOPES, GamePlatformPlayer, GameServiceAvailability, GameServiceProvider, GameServiceScope, PlatformGames} from "./GameServicesTypes";

type GameServicesStorage = Pick<typeof AsyncStorage, "getItem" | "setItem">;
type Progress = {unlocked: GameAchievementId[]; reported: GameAchievementId[]; bestTopweekScore: number; reportedTopweekScore: number};
type Listener = () => void;
export type GameServicesSnapshot = {
	provider: GameServiceProvider;
	availability: GameServiceAvailability;
	storageScope?: GameServiceScope;
	player: GamePlatformPlayer | null;
	bestTopweekScore: number;
	busy: boolean;
	syncFailed: boolean;
};

const UNASSIGNED_PROFILE = "unassigned";

export function gameProgressKey(provider: GameServiceProvider, playerId: string, scope?: GameServiceScope): string {
	return scope ? `gameServices:${provider}:${scope}:${playerId}` : `gameServices:${provider}:${playerId}`;
}

function emptyProgress(): Progress {
	return {unlocked: [], reported: [], bestTopweekScore: 0, reportedTopweekScore: 0};
}

function isAchievement(value: unknown): value is GameAchievementId {
	return Object.values(GAME_ACHIEVEMENTS).some(achievement => achievement === value);
}

function validScore(value: unknown): value is number {
	return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function readProgress(stored: string | null): Progress {
	if (!stored) return emptyProgress();
	try {
		const value: unknown = JSON.parse(stored);
		if (!value || typeof value !== "object") return emptyProgress();
		const fields = value as Record<string, unknown>;
		const unlocked = Array.isArray(fields.unlocked) ? fields.unlocked.filter(isAchievement) : [];
		return {
			unlocked,
			reported: Array.isArray(fields.reported) ? fields.reported.filter(isAchievement).filter(achievement => unlocked.includes(achievement)) : [],
			bestTopweekScore: validScore(fields.bestTopweekScore) ? fields.bestTopweekScore : 0,
			reportedTopweekScore: validScore(fields.reportedTopweekScore) ? fields.reportedTopweekScore : 0
		};
	}
	catch {
		return emptyProgress();
	}
}

export class GameServicesStore {
	private snapshot: GameServicesSnapshot;
	private tail: Promise<void> = Promise.resolve();
	private readonly listeners = new Set<Listener>();

	public constructor(private readonly platform: PlatformGames, private readonly storage: GameServicesStorage) {
		this.snapshot = {provider: platform.provider, availability: platform.availability, ...(platform.storageScope ? {storageScope: platform.storageScope} : {}), player: null, bestTopweekScore: 0, busy: false, syncFailed: false};
	}

	public readonly getSnapshot = (): GameServicesSnapshot => this.snapshot;
	public readonly subscribe = (listener: Listener): (() => void) => {
		this.listeners.add(listener);
		return (): void => {this.listeners.delete(listener);};
	};

	private update(patch: Partial<GameServicesSnapshot>): void {
		this.snapshot = {...this.snapshot, ...patch};
		for (const listener of this.listeners) listener();
	}

	private enqueue(operation: () => Promise<void>): Promise<void> {
		const next = this.tail.then(async (): Promise<void> => {
			this.update({busy: true, syncFailed: false});
			try {
				await operation();
			}
			catch (error: unknown) {
				this.update({syncFailed: true});
				console.warn("Game services operation failed:", error);
			}
			finally {
				this.update({busy: false});
			}
		});
		this.tail = next;
		return next;
	}

	private load(playerId: string): Promise<Progress> {
		return this.storage.getItem(gameProgressKey(this.platform.provider, playerId, this.platform.storageScope)).then(readProgress);
	}

	private save(playerId: string, progress: Progress): Promise<void> {
		return this.storage.setItem(gameProgressKey(this.platform.provider, playerId, this.platform.storageScope), JSON.stringify(progress));
	}

	private async currentPlayer(): Promise<GamePlatformPlayer | null> {
		if (this.platform.availability !== GAME_SERVICE_AVAILABILITY.AVAILABLE) return null;
		const remembered = this.snapshot.player;
		try {
			return await this.platform.getPlayer();
		}
		catch {
			return remembered;
		}
	}

	private async selectPlayer(player: GamePlatformPlayer | null): Promise<Progress> {
		const progress = await this.load(player?.id ?? UNASSIGNED_PROFILE);
		this.update({player, bestTopweekScore: progress.bestTopweekScore});
		return progress;
	}

	private async adoptUnassigned(player: GamePlatformPlayer, progress: Progress): Promise<void> {
		const unassigned = await this.load(UNASSIGNED_PROFILE);
		if (!unassigned.unlocked.length && unassigned.bestTopweekScore === 0) return;
		progress.unlocked = [...new Set([...progress.unlocked, ...unassigned.unlocked])];
		progress.bestTopweekScore = Math.max(progress.bestTopweekScore, unassigned.bestTopweekScore);
		await this.save(player.id, progress);
		await this.save(UNASSIGNED_PROFILE, emptyProgress());
		this.update({bestTopweekScore: progress.bestTopweekScore});
	}

	private async stillCurrent(player: GamePlatformPlayer): Promise<boolean> {
		const current = await this.platform.getPlayer();
		if (current?.id === player.id) return true;
		await this.selectPlayer(current);
		return false;
	}

	private async flush(player: GamePlatformPlayer | null, progress: Progress): Promise<void> {
		if (!player || this.platform.availability !== GAME_SERVICE_AVAILABILITY.AVAILABLE) return;
		for (const achievement of progress.unlocked.filter(earned => !progress.reported.includes(earned))) {
			if (!await this.stillCurrent(player)) return;
			await this.platform.unlockAchievement(achievement);
			progress.reported.push(achievement);
			await this.save(player.id, progress);
		}
		if (progress.bestTopweekScore <= progress.reportedTopweekScore) return;
		if (!await this.stillCurrent(player)) return;
		await this.platform.submitTopweekScore(progress.bestTopweekScore);
		progress.reportedTopweekScore = progress.bestTopweekScore;
		await this.save(player.id, progress);
	}

	private acceptsProgress(): boolean {
		return this.platform.provider !== GAME_SERVICE_PROVIDERS.GAME_CENTER || this.platform.availability !== GAME_SERVICE_AVAILABILITY.NOT_CONFIGURED;
	}

	public refresh(): Promise<void> {
		return this.enqueue(async (): Promise<void> => {
			const player = await this.currentPlayer();
			const progress = await this.selectPlayer(player);
			if (player) await this.adoptUnassigned(player, progress);
			await this.flush(player, progress);
		});
	}

	public connect(): Promise<void> {
		if (this.platform.availability !== GAME_SERVICE_AVAILABILITY.AVAILABLE) return Promise.resolve();
		return this.enqueue(async (): Promise<void> => {
			const player = await this.platform.connect();
			const progress = await this.selectPlayer(player);
			if (player) await this.adoptUnassigned(player, progress);
			await this.flush(player, progress);
		});
	}

	public recordFightEnd(result: FightEnd): Promise<void> {
		if (!this.acceptsProgress()) return Promise.resolve();
		const achievements = achievementsForFightEnd(result);
		if (!achievements.length) return Promise.resolve();
		const owner = this.currentPlayer();
		return this.enqueue(async (): Promise<void> => {
			const player = await owner;
			const progress = await this.selectPlayer(player);
			progress.unlocked = [...new Set([...progress.unlocked, ...achievements])];
			await this.save(player?.id ?? UNASSIGNED_PROFILE, progress);
			await this.flush(player, progress);
		});
	}

	public recordRanking(ranking: TopRes): Promise<void> {
		if (!this.acceptsProgress()) return Promise.resolve();
		if (ranking.dataType !== TopDataType.SCORE || ranking.timing !== TopTiming.WEEK) return Promise.resolve();
		const score = ranking.elements.find(entry => entry.sameContext)?.value;
		if (!validScore(score)) return Promise.resolve();
		const owner = this.currentPlayer();
		return this.enqueue(async (): Promise<void> => {
			const player = await owner;
			const progress = await this.selectPlayer(player);
			progress.bestTopweekScore = Math.max(progress.bestTopweekScore, score);
			await this.save(player?.id ?? UNASSIGNED_PROFILE, progress);
			this.update({bestTopweekScore: progress.bestTopweekScore});
			await this.flush(player, progress);
		});
	}

	private present(operation: () => Promise<void>): Promise<void> {
		return operation().catch((error: unknown): void => {
			this.update({syncFailed: true});
			console.warn("Unable to open game services:", error);
		});
	}

	public showAchievements(): Promise<void> {
		return this.present(this.platform.showAchievements);
	}

	public showTopweekLeaderboard(): Promise<void> {
		return this.present(this.platform.showTopweekLeaderboard);
	}

	public resetLocalProgress(): Promise<void> {
		if (this.platform.storageScope !== GAME_SERVICE_SCOPES.LOCAL) return Promise.resolve();
		return this.enqueue(async (): Promise<void> => {
			const player = await this.currentPlayer();
			if (player) await this.save(player.id, emptyProgress());
			await this.save(UNASSIGNED_PROFILE, emptyProgress());
			this.update({player, bestTopweekScore: 0});
		});
	}
}