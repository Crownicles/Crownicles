import {requireOptionalNativeModule} from "expo";
import type {GameCenterModule, GameCenterPlayer} from "expo-game-center";
import {gameServicesConfiguration} from "./GameServicesConfig";
import {ACHIEVEMENT_COMPLETION_PERCENT} from "./Achievements";
import {GAME_SERVICE_AVAILABILITY, GAME_SERVICE_ERRORS, GAME_SERVICE_PROVIDERS, GamePlatformPlayer, PlatformGames} from "./GameServicesTypes";

function playerIdentity(player: GameCenterPlayer | null): GamePlatformPlayer | null {
	return player ? {id: player.playerID, displayName: player.displayName} : null;
}

function submitted(success: boolean): void {
	if (!success) throw new Error(GAME_SERVICE_ERRORS.SUBMISSION_FAILED);
}

export function createPlatformGames(): PlatformGames {
	const config = gameServicesConfiguration(GAME_SERVICE_PROVIDERS.GAME_CENTER);
	const native = requireOptionalNativeModule<GameCenterModule>("ExpoGameCenter");
	return {
		provider: GAME_SERVICE_PROVIDERS.GAME_CENTER,
		availability: native ? GAME_SERVICE_AVAILABILITY.AVAILABLE : GAME_SERVICE_AVAILABILITY.NATIVE_UNAVAILABLE,
		getPlayer: async () => native ? playerIdentity(await native.getLocalPlayer()) : null,
		connect: async () => native && await native.authenticateLocalPlayer() ? playerIdentity(await native.getLocalPlayer()) : null,
		unlockAchievement: async achievement => {
			if (!native) throw new Error(GAME_SERVICE_ERRORS.UNAVAILABLE);
			submitted(await native.reportAchievement(config.achievements[achievement], ACHIEVEMENT_COMPLETION_PERCENT));
		},
		submitTopweekScore: async score => {
			if (!native) throw new Error(GAME_SERVICE_ERRORS.UNAVAILABLE);
			submitted(await native.submitScore(score, config.topweekLeaderboardId));
		},
		showAchievements: async () => {
			if (!native) throw new Error(GAME_SERVICE_ERRORS.UNAVAILABLE);
			await native.presentAchievements();
		},
		showTopweekLeaderboard: async () => {
			if (!native) throw new Error(GAME_SERVICE_ERRORS.UNAVAILABLE);
			await native.presentLeaderboard(config.topweekLeaderboardId);
		}
	};
}