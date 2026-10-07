import {GAME_SERVICE_AVAILABILITY, GAME_SERVICE_ERRORS, GAME_SERVICE_PROVIDERS, PlatformGames} from "./GameServicesTypes";

export function createPlatformGames(): PlatformGames {
	return {
		provider: GAME_SERVICE_PROVIDERS.UNSUPPORTED,
		availability: GAME_SERVICE_AVAILABILITY.UNSUPPORTED,
		getPlayer: () => Promise.resolve(null),
		connect: () => Promise.resolve(null),
		unlockAchievement: () => Promise.reject(new Error(GAME_SERVICE_ERRORS.UNAVAILABLE)),
		submitTopweekScore: () => Promise.reject(new Error(GAME_SERVICE_ERRORS.UNAVAILABLE)),
		showAchievements: () => Promise.reject(new Error(GAME_SERVICE_ERRORS.UNAVAILABLE)),
		showTopweekLeaderboard: () => Promise.reject(new Error(GAME_SERVICE_ERRORS.UNAVAILABLE))
	};
}