import {requireOptionalNativeModule} from "expo";
import type {GameCenterModule, GameCenterPlayer} from "expo-game-center";
import {gameServicesConfiguration} from "./GameServicesConfig";
import {ACHIEVEMENT_COMPLETION_PERCENT, GAME_ACHIEVEMENTS} from "./Achievements";
import {GAME_CENTER_MODES, GAME_SERVICE_AVAILABILITY, GAME_SERVICE_ERRORS, GAME_SERVICE_PROVIDERS, GAME_SERVICE_SCOPES, GamePlatformPlayer, PlatformGames} from "./GameServicesTypes";
import localCatalog from "../../game-services/CrowniclesLocal.gamekit/gameCenterResources.json";

type ScopedGameCenterModule = GameCenterModule & {crowniclesLocalTestLaunch?: boolean};

function playerIdentity(player: GameCenterPlayer | null): GamePlatformPlayer | null {
	return player ? {id: player.playerID, displayName: player.displayName} : null;
}

function submitted(success: boolean): void {
	if (!success) throw new Error(GAME_SERVICE_ERRORS.SUBMISSION_FAILED);
}

export function createPlatformGames(): PlatformGames {
	const config = gameServicesConfiguration(GAME_SERVICE_PROVIDERS.GAME_CENTER);
	const native = requireOptionalNativeModule<ScopedGameCenterModule>("ExpoGameCenter");
	const localLaunch = native?.crowniclesLocalTestLaunch === true;
	const configured = localLaunch || config.gameCenterMode === GAME_CENTER_MODES.PRODUCTION;
	const achievements = localLaunch ? {[GAME_ACHIEVEMENTS.PVP_FIGHT_COMPLETED]: localCatalog.resources.achievements[0].vendorIdentifier} : config.achievements;
	const leaderboardId = localLaunch ? localCatalog.resources.leaderboards[0].vendorIdentifier : config.topweekLeaderboardId;
	const client = configured ? native : null;
	return {
		provider: GAME_SERVICE_PROVIDERS.GAME_CENTER,
		availability: !configured ? GAME_SERVICE_AVAILABILITY.NOT_CONFIGURED : native ? GAME_SERVICE_AVAILABILITY.AVAILABLE : GAME_SERVICE_AVAILABILITY.NATIVE_UNAVAILABLE,
		storageScope: config.gameCenterMode === GAME_CENTER_MODES.LOCAL || localLaunch ? GAME_SERVICE_SCOPES.LOCAL : GAME_SERVICE_SCOPES.PRODUCTION,
		getPlayer: async () => client ? playerIdentity(await client.getLocalPlayer()) : null,
		connect: async () => client && await client.authenticateLocalPlayer() ? playerIdentity(await client.getLocalPlayer()) : null,
		unlockAchievement: async achievement => {
			if (!client) throw new Error(GAME_SERVICE_ERRORS.UNAVAILABLE);
			submitted(await client.reportAchievement(achievements[achievement], ACHIEVEMENT_COMPLETION_PERCENT));
		},
		submitTopweekScore: async score => {
			if (!client) throw new Error(GAME_SERVICE_ERRORS.UNAVAILABLE);
			submitted(await client.submitScore(score, leaderboardId));
		},
		showAchievements: async () => {
			if (!client) throw new Error(GAME_SERVICE_ERRORS.UNAVAILABLE);
			await client.presentAchievements();
		},
		showTopweekLeaderboard: async () => {
			if (!client) throw new Error(GAME_SERVICE_ERRORS.UNAVAILABLE);
			await client.presentLeaderboard(leaderboardId);
		}
	};
}