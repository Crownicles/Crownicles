import {TurboModule, TurboModuleRegistry} from "react-native";
import GooglePlayGames, {GooglePlayGamesPlayer} from "react-native-google-play-games";
import {gameServicesConfiguration} from "./GameServicesConfig";
import {GAME_SERVICE_PROVIDERS, GamePlatformPlayer, PlatformGames, platformAvailability} from "./GameServicesTypes";

function playerIdentity(player: GooglePlayGamesPlayer | null): GamePlatformPlayer | null {
	return player ? {id: player.id, displayName: player.displayName} : null;
}

async function authenticatedPlayer(): Promise<GamePlatformPlayer | null> {
	return await GooglePlayGames.isAuthenticated() ? playerIdentity(await GooglePlayGames.getPlayer()) : null;
}

export function createPlatformGames(): PlatformGames {
	const config = gameServicesConfiguration(GAME_SERVICE_PROVIDERS.PLAY_GAMES);
	const configured = Boolean(config.appId && config.topweekLeaderboardId && Object.values(config.achievements).every(Boolean));
	const native = TurboModuleRegistry.get<TurboModule>("GooglePlayGames");
	const usable = configured && native !== null;
	return {
		provider: GAME_SERVICE_PROVIDERS.PLAY_GAMES,
		availability: platformAvailability(configured, native !== null),
		getPlayer: async () => usable ? authenticatedPlayer() : null,
		connect: async () => playerIdentity(await GooglePlayGames.isAuthenticated() ? await GooglePlayGames.getPlayer() : await GooglePlayGames.signIn()),
		unlockAchievement: async achievement => {await GooglePlayGames.unlockAchievement(config.achievements[achievement]);},
		submitTopweekScore: async score => {await GooglePlayGames.submitScore(config.topweekLeaderboardId, score);},
		showAchievements: GooglePlayGames.showAchievements,
		showTopweekLeaderboard: async () => {await GooglePlayGames.showLeaderboard(config.topweekLeaderboardId);}
	};
}