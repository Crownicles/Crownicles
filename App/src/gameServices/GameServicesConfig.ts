import Constants from "expo-constants";
import {GAME_ACHIEVEMENTS, GameAchievementId} from "./Achievements";
import {GAME_SERVICE_PROVIDERS, GameServiceProvider} from "./GameServicesTypes";

type GameServicesConfiguration = {
	appId: string;
	achievements: Record<GameAchievementId, string>;
	topweekLeaderboardId: string;
};

function object(value: unknown): Record<string, unknown> {
	return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function identifier(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

export function gameServicesConfiguration(provider: GameServiceProvider): GameServicesConfiguration {
	const services = object(Constants.expoConfig?.extra?.gameServices);
	const config = object(services[provider]);
	return {
		appId: provider === GAME_SERVICE_PROVIDERS.PLAY_GAMES ? identifier(config.appId) : "",
		achievements: {[GAME_ACHIEVEMENTS.PVP_FIGHT_COMPLETED]: identifier(config.pvpAchievementId)},
		topweekLeaderboardId: identifier(config.topweekLeaderboardId)
	};
}