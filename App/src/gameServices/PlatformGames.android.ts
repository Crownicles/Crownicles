import {TurboModule, TurboModuleRegistry} from "react-native";
import GooglePlayGames, {GooglePlayGamesPlayer} from "react-native-google-play-games";
import {gameServicesConfiguration} from "./GameServicesConfig";
import {GAME_SERVICE_AVAILABILITY, GAME_SERVICE_PROVIDERS, GamePlatformPlayer, PlatformGames} from "./GameServicesTypes";

function playerIdentity(player: GooglePlayGamesPlayer | null): GamePlatformPlayer | null {
	return player ? {id: player.id, displayName: player.displayName} : null;
}

export function createPlatformGames(): PlatformGames {
	const config = gameServicesConfiguration(GAME_SERVICE_PROVIDERS.PLAY_GAMES);
	const configured = Boolean(config.appId && config.topweekLeaderboardId && Object.values(config.achievements).every(Boolean));
	const native = TurboModuleRegistry.get<TurboModule>("GooglePlayGames");
	return {
		provider: GAME_SERVICE_PROVIDERS.PLAY_GAMES,
		availability: !configured ? GAME_SERVICE_AVAILABILITY.NOT_CONFIGURED : native ? GAME_SERVICE_AVAILABILITY.AVAILABLE : GAME_SERVICE_AVAILABILITY.NATIVE_UNAVAILABLE,
		getPlayer: async () => configured && native && await GooglePlayGames.isAuthenticated() ? playerIdentity(await GooglePlayGames.getPlayer()) : null,
		connect: async () => playerIdentity(await GooglePlayGames.isAuthenticated() ? await GooglePlayGames.getPlayer() : await GooglePlayGames.signIn()),
		unlockAchievement: async achievement => {await GooglePlayGames.unlockAchievement(config.achievements[achievement]);},
		submitTopweekScore: async score => {await GooglePlayGames.submitScore(config.topweekLeaderboardId, score);},
		showAchievements: GooglePlayGames.showAchievements,
		showTopweekLeaderboard: async () => {await GooglePlayGames.showLeaderboard(config.topweekLeaderboardId);}
	};
}