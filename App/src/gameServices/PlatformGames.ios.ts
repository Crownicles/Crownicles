import {requireOptionalNativeModule} from "expo";
import type {GameCenterModule, GameCenterPlayer} from "expo-game-center";
import {GameServicesConfiguration, gameServicesConfiguration} from "./GameServicesConfig";
import {ACHIEVEMENT_COMPLETION_PERCENT, GAME_ACHIEVEMENTS, GameAchievementId} from "./Achievements";
import {GAME_CENTER_MODES, GAME_SERVICE_ERRORS, GAME_SERVICE_PROVIDERS, GAME_SERVICE_SCOPES, GamePlatformPlayer, PlatformGames, platformAvailability} from "./GameServicesTypes";
import localCatalog from "../../game-services/CrowniclesLocal.gamekit/gameCenterResources.json";

type ScopedGameCenterModule = GameCenterModule & {crowniclesLocalTestLaunch?: boolean};
type GameCenterIdentifiers = {achievements: Record<GameAchievementId, string>; leaderboardId: string};

function playerIdentity(player: GameCenterPlayer | null): GamePlatformPlayer | null {
	return player ? {id: player.playerID, displayName: player.displayName} : null;
}

function submitted(success: boolean): void {
	if (!success) throw new Error(GAME_SERVICE_ERRORS.SUBMISSION_FAILED);
}

function usable(client: GameCenterModule | null): GameCenterModule {
	if (!client) throw new Error(GAME_SERVICE_ERRORS.UNAVAILABLE);
	return client;
}

/** A local GameKit test launch reads the bundled catalog instead of App Store Connect */
function gameCenterIdentifiers(localLaunch: boolean, config: GameServicesConfiguration): GameCenterIdentifiers {
	if (!localLaunch) return {achievements: config.achievements, leaderboardId: config.topweekLeaderboardId};
	return {
		achievements: {[GAME_ACHIEVEMENTS.PVP_FIGHT_COMPLETED]: localCatalog.resources.achievements[0].vendorIdentifier},
		leaderboardId: localCatalog.resources.leaderboards[0].vendorIdentifier
	};
}

export function createPlatformGames(): PlatformGames {
	const config = gameServicesConfiguration(GAME_SERVICE_PROVIDERS.GAME_CENTER);
	const native = requireOptionalNativeModule<ScopedGameCenterModule>("ExpoGameCenter");
	const localLaunch = native?.crowniclesLocalTestLaunch === true;
	const configured = localLaunch || config.gameCenterMode === GAME_CENTER_MODES.PRODUCTION;
	const local = localLaunch || config.gameCenterMode === GAME_CENTER_MODES.LOCAL;
	const {achievements, leaderboardId} = gameCenterIdentifiers(localLaunch, config);
	const client = configured ? native : null;
	return {
		provider: GAME_SERVICE_PROVIDERS.GAME_CENTER,
		availability: platformAvailability(configured, native !== null),
		storageScope: local ? GAME_SERVICE_SCOPES.LOCAL : GAME_SERVICE_SCOPES.PRODUCTION,
		getPlayer: async () => client ? playerIdentity(await client.getLocalPlayer()) : null,
		connect: async () => client && await client.authenticateLocalPlayer() ? playerIdentity(await client.getLocalPlayer()) : null,
		unlockAchievement: async achievement => {
			submitted(await usable(client).reportAchievement(achievements[achievement], ACHIEVEMENT_COMPLETION_PERCENT));
		},
		submitTopweekScore: async score => {
			submitted(await usable(client).submitScore(score, leaderboardId));
		},
		showAchievements: async () => {
			await usable(client).presentAchievements();
		},
		showTopweekLeaderboard: async () => {
			await usable(client).presentLeaderboard(leaderboardId);
		}
	};
}