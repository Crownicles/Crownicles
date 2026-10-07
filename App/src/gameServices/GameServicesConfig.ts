import Constants from "expo-constants";
import {GAME_ACHIEVEMENTS, GameAchievementId} from "./Achievements";
import {GAME_CENTER_MODES, GameCenterMode, GAME_SERVICE_PROVIDERS, GameServiceProvider} from "./GameServicesTypes";

export type GameServicesConfiguration = {
	appId: string;
	gameCenterMode: GameCenterMode;
	achievements: Record<GameAchievementId, string>;
	topweekLeaderboardId: string;
};

function object(value: unknown): Record<string, unknown> {
	return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function identifier(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

function gameCenterMode(value: unknown): GameCenterMode {
	return value === GAME_CENTER_MODES.LOCAL || value === GAME_CENTER_MODES.PRODUCTION ? value : GAME_CENTER_MODES.DISABLED;
}

export function gameServicesConfiguration(provider: GameServiceProvider): GameServicesConfiguration {
	const services = object(Constants.expoConfig?.extra?.gameServices);
	const config = object(services[provider]);
	return {
		appId: provider === GAME_SERVICE_PROVIDERS.PLAY_GAMES ? identifier(config.appId) : "",
		gameCenterMode: gameCenterMode(config.mode),
		achievements: {[GAME_ACHIEVEMENTS.PVP_FIGHT_COMPLETED]: identifier(config.pvpAchievementId)},
		topweekLeaderboardId: identifier(config.topweekLeaderboardId)
	};
}