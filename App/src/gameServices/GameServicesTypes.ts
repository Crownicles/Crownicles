import type {GameAchievementId} from "./Achievements";

export const GAME_SERVICE_PROVIDERS = {
	GAME_CENTER: "gameCenter",
	PLAY_GAMES: "playGames",
	UNSUPPORTED: "unsupported"
} as const;

export type GameServiceProvider = typeof GAME_SERVICE_PROVIDERS[keyof typeof GAME_SERVICE_PROVIDERS];

export const GAME_SERVICE_AVAILABILITY = {
	AVAILABLE: "available",
	UNSUPPORTED: "unsupported",
	NOT_CONFIGURED: "notConfigured",
	NATIVE_UNAVAILABLE: "nativeUnavailable"
} as const;

export type GameServiceAvailability = typeof GAME_SERVICE_AVAILABILITY[keyof typeof GAME_SERVICE_AVAILABILITY];
export type GamePlatformPlayer = {id: string; displayName: string};

export interface PlatformGames {
	readonly provider: GameServiceProvider;
	readonly availability: GameServiceAvailability;
	getPlayer(): Promise<GamePlatformPlayer | null>;
	connect(): Promise<GamePlatformPlayer | null>;
	unlockAchievement(achievement: GameAchievementId): Promise<void>;
	submitTopweekScore(score: number): Promise<void>;
	showAchievements(): Promise<void>;
	showTopweekLeaderboard(): Promise<void>;
}

export const GAME_SERVICE_ERRORS = {
	UNAVAILABLE: "gameServicesUnavailable",
	SUBMISSION_FAILED: "gameServicesSubmissionFailed"
} as const;