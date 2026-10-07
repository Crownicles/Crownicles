import type {GameAchievementId} from "./Achievements";

export const GAME_SERVICE_PROVIDERS = {
	GAME_CENTER: "gameCenter",
	PLAY_GAMES: "playGames",
	UNSUPPORTED: "unsupported"
} as const;

export type GameServiceProvider = typeof GAME_SERVICE_PROVIDERS[keyof typeof GAME_SERVICE_PROVIDERS];

export const GAME_SERVICE_SCOPES = {
	LOCAL: "local",
	PRODUCTION: "production"
} as const;

export type GameServiceScope = typeof GAME_SERVICE_SCOPES[keyof typeof GAME_SERVICE_SCOPES];

export const GAME_CENTER_MODES = {
	DISABLED: "disabled",
	...GAME_SERVICE_SCOPES
} as const;

export type GameCenterMode = typeof GAME_CENTER_MODES[keyof typeof GAME_CENTER_MODES];

export const GAME_SERVICE_AVAILABILITY = {
	AVAILABLE: "available",
	UNSUPPORTED: "unsupported",
	NOT_CONFIGURED: "notConfigured",
	NATIVE_UNAVAILABLE: "nativeUnavailable"
} as const;

export type GameServiceAvailability = typeof GAME_SERVICE_AVAILABILITY[keyof typeof GAME_SERVICE_AVAILABILITY];
export type GamePlatformPlayer = {id: string; displayName: string};

export function platformAvailability(configured: boolean, nativeAvailable: boolean): GameServiceAvailability {
	if (!configured) return GAME_SERVICE_AVAILABILITY.NOT_CONFIGURED;
	return nativeAvailable ? GAME_SERVICE_AVAILABILITY.AVAILABLE : GAME_SERVICE_AVAILABILITY.NATIVE_UNAVAILABLE;
}

export interface PlatformGames {
	readonly provider: GameServiceProvider;
	readonly availability: GameServiceAvailability;
	readonly storageScope?: GameServiceScope;
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