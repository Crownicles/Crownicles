import {AndroidConfig} from "expo/config-plugins";
import {configurePlayGamesManifest} from "../../plugins/withGameServices";
import {requireOptionalNativeModule} from "expo";
import {TurboModuleRegistry} from "react-native";
import GooglePlayGames from "react-native-google-play-games";
import {createPlatformGames as iosGames} from "@/src/gameServices/PlatformGames.ios";
import {createPlatformGames as androidGames} from "@/src/gameServices/PlatformGames.android";
import {GAME_ACHIEVEMENTS} from "@/src/gameServices/Achievements";
import {GAME_SERVICE_AVAILABILITY} from "@/src/gameServices/GameServicesTypes";
import localCatalog from "../../game-services/CrowniclesLocal.gamekit/gameCenterResources.json";
import Constants from "expo-constants";
import {createLocalGameKitScheme} from "../../plugins/withGameCenterLocal";
import {parseStringPromise} from "xml2js";
import {execFileSync} from "node:child_process";
import path from "node:path";

jest.mock("expo", () => ({requireOptionalNativeModule: jest.fn()}));
jest.mock("expo-constants", () => ({__esModule: true, default: {expoConfig: {extra: {gameServices: {
	gameCenter: {mode: "production", pvpAchievementId: "apple-pvp", topweekLeaderboardId: "apple-topweek"},
	playGames: {appId: "123456789", pvpAchievementId: "google-pvp", topweekLeaderboardId: "google-topweek"}
}}}}}));
jest.mock("react-native-google-play-games", () => ({__esModule: true, default: {
	isAuthenticated: jest.fn(() => Promise.resolve(true)),
	getPlayer: jest.fn(() => Promise.resolve({id: "google-player", displayName: "Profil Google"})),
	signIn: jest.fn(), unlockAchievement: jest.fn(() => Promise.resolve()),
	submitScore: jest.fn(() => Promise.resolve()), showAchievements: jest.fn(), showLeaderboard: jest.fn()
}}));

function manifest(): AndroidConfig.Manifest.AndroidManifest {
	return {manifest: {$: {"xmlns:android": "http://schemas.android.com/apk/res/android"}, queries: [], application: [{$: {"android:name": ".MainApplication"}}]}};
}

describe("game services native configuration", () => {
	it("routes the GameKit iPhone launcher to the Mac even with stale alpha Expo URLs", () => {
		const output = execFileSync(process.execPath, ["scripts/gamekit-local.mjs", "metro", "--dry-run"], {
			cwd: path.resolve(__dirname, "../.."),
			encoding: "utf8",
			env: {
				...process.env,
				CROWNICLES_DEVICE_HOST: "iphone-dev.local",
				CROWNICLES_REST_API_URL: "",
				CROWNICLES_WEBSOCKET_URL: "",
				CROWNICLES_KEYCLOAK_URL: "",
				EXPO_PUBLIC_REST_API_URL: "https://alpha-api.example.invalid",
				EXPO_PUBLIC_WEBSOCKET_URL: "wss://alpha-ws.example.invalid",
				EXPO_PUBLIC_KEYCLOAK_URL: "https://alpha-auth.example.invalid"
			}
		});
		expect(output).toContain("REST API: http://iphone-dev.local:10500");
		expect(output).toContain("WebSocket: ws://iphone-dev.local:10501");
		expect(output).toContain("Keycloak: http://iphone-dev.local:8080");
		expect(output).not.toContain("example.invalid");
	});

	it("generates a runnable local scheme with Debug Mode, its native marker and no archive action", async () => {
		const source = `<?xml version="1.0"?><Scheme><BuildAction><BuildActionEntries><BuildActionEntry buildForArchiving="YES" /></BuildActionEntries></BuildAction><LaunchAction buildConfiguration="Release"><BuildableProductRunnable /></LaunchAction><ArchiveAction buildConfiguration="Release" /></Scheme>`;
		const local = await parseStringPromise(await createLocalGameKitScheme(source));
		expect(local.Scheme.LaunchAction[0].$).toMatchObject({buildConfiguration: "Debug", enableGameKitDebugMode: "YES"});
		expect(local.Scheme.LaunchAction[0].EnvironmentVariables[0].EnvironmentVariable).toEqual([{$: {key: "CROWNICLES_GAMEKIT_LOCAL_TEST", value: "1", isEnabled: "YES"}}]);
		expect(local.Scheme.ArchiveAction).toBeUndefined();
		expect(local.Scheme.BuildAction[0].BuildActionEntries[0].BuildActionEntry[0].$.buildForArchiving).toBe("NO");
		const repeated = await parseStringPromise(await createLocalGameKitScheme(await createLocalGameKitScheme(source)));
		expect(repeated.Scheme.LaunchAction[0].EnvironmentVariables[0].EnvironmentVariable).toHaveLength(1);
		const normal = await parseStringPromise(source);
		expect(normal.Scheme.LaunchAction[0].$.enableGameKitDebugMode).toBeUndefined();
	});

	it("defines only local, non-repeatable PvP progress and a permanent descending best-score board", () => {
		const achievement = localCatalog.resources.achievements[0];
		const leaderboard = localCatalog.resources.leaderboards[0];
		expect(localCatalog.resources.achievements).toHaveLength(1);
		expect(localCatalog.resources.leaderboards).toHaveLength(1);
		expect(achievement).toMatchObject({repeatable: false, showBeforeEarned: true, vendorIdentifier: "com.crownicles.app.local.pvp_fight_completed"});
		expect(leaderboard).toMatchObject({scoreSortType: "DESC", submissionType: "BEST_SCORE", vendorIdentifier: "com.crownicles.app.local.topweek_best"});
		expect(leaderboard).not.toHaveProperty("recurrenceRule");
		expect(Object.keys(localCatalog.resources.achievementLocalizations)).toEqual([achievement.vendorIdentifier]);
		expect(Object.keys(localCatalog.resources.leaderboardLocalizations)).toEqual([leaderboard.vendorIdentifier]);
	});

	it("removes the automatic Play Games initializer until the project is configured", () => {
		const configured = configurePlayGamesManifest(manifest(), "");
		expect(configured.manifest.application[0].provider).toEqual([{$: {"android:name": "com.reactnativegoogleplaygames.GooglePlayGamesInitProvider", "tools:node": "remove"}}]);
	});

	it("configures the real app ID and avoids forcing profile creation", () => {
		const configured = configurePlayGamesManifest(manifest(), "123456789");
		expect(configured.manifest.application[0]["meta-data"]).toEqual([
			{$: {"android:name": "com.google.android.gms.games.APP_ID", "android:value": "@string/play_games_app_id"}},
			{$: {"android:name": "com.google.android.gms.games.SUPPRESS_GAME_PROFILE_CREATION", "android:value": "true"}}
		]);
		expect(configured.manifest.application[0].provider).toEqual([]);
	});

	it("can be reapplied and switches safely from unconfigured to configured", () => {
		const configured = configurePlayGamesManifest(configurePlayGamesManifest(manifest(), ""), "123456789");
		configurePlayGamesManifest(configured, "123456789");
		expect(configured.manifest.application[0]["meta-data"]).toHaveLength(2);
		expect(configured.manifest.application[0].provider).toEqual([]);
	});
});

describe("native game services SDK contracts", () => {
	afterEach(() => {Constants.expoConfig!.extra!.gameServices.gameCenter.mode = "production"; jest.clearAllMocks(); jest.restoreAllMocks();});

	it("refuses local SDK calls unless launched with the local Xcode scheme marker", async () => {
		Constants.expoConfig!.extra!.gameServices.gameCenter.mode = "local";
		const native = {reportAchievement: jest.fn(() => Promise.resolve(true)), submitScore: jest.fn(() => Promise.resolve(true))};
		jest.mocked(requireOptionalNativeModule).mockReturnValue(native);
		const games = iosGames();
		expect(games.availability).toBe(GAME_SERVICE_AVAILABILITY.NOT_CONFIGURED);
		await expect(games.unlockAchievement(GAME_ACHIEVEMENTS.PVP_FIGHT_COMPLETED)).rejects.toThrow("gameServicesUnavailable");
		expect(native.reportAchievement).not.toHaveBeenCalled();
	});

	it("uses only local IDs inside the local scheme even if Metro returns a production configuration", async () => {
		const native = {crowniclesLocalTestLaunch: true, reportAchievement: jest.fn(() => Promise.resolve(true)), submitScore: jest.fn(() => Promise.resolve(true))};
		jest.mocked(requireOptionalNativeModule).mockReturnValue(native);
		const games = iosGames();
		expect(games.availability).toBe(GAME_SERVICE_AVAILABILITY.AVAILABLE);
		await games.unlockAchievement(GAME_ACHIEVEMENTS.PVP_FIGHT_COMPLETED);
		await games.submitTopweekScore(500);
		expect(native.reportAchievement).toHaveBeenCalledWith("com.crownicles.app.local.pvp_fight_completed", 100);
		expect(native.submitScore).toHaveBeenCalledWith(500, "com.crownicles.app.local.topweek_best");
	});

	it("allows local GameKit only with matching app mode and native launch marker", async () => {
		Constants.expoConfig!.extra!.gameServices.gameCenter.mode = "local";
		jest.mocked(requireOptionalNativeModule).mockReturnValue({crowniclesLocalTestLaunch: true, reportAchievement: jest.fn(() => Promise.resolve(true))});
		const games = iosGames();
		expect(games.availability).toBe(GAME_SERVICE_AVAILABILITY.AVAILABLE);
		expect(games.storageScope).toBe("local");
		await games.unlockAchievement(GAME_ACHIEVEMENTS.PVP_FIGHT_COMPLETED);
	});

	it("reports full achievement completion and sends score then ID to Game Center", async () => {
		const native = {reportAchievement: jest.fn(() => Promise.resolve(true)), submitScore: jest.fn(() => Promise.resolve(true))};
		jest.mocked(requireOptionalNativeModule).mockReturnValue(native);
		const games = iosGames();
		await games.unlockAchievement(GAME_ACHIEVEMENTS.PVP_FIGHT_COMPLETED);
		await games.submitTopweekScore(500);
		expect(native.reportAchievement).toHaveBeenCalledWith("apple-pvp", 100);
		expect(native.submitScore).toHaveBeenCalledWith(500, "apple-topweek");
	});

	it("does not acknowledge an achievement that Game Center refuses", async () => {
		jest.mocked(requireOptionalNativeModule).mockReturnValue({reportAchievement: jest.fn(() => Promise.resolve(false))});
		await expect(iosGames().unlockAchievement(GAME_ACHIEVEMENTS.PVP_FIGHT_COMPLETED)).rejects.toThrow("gameServicesSubmissionFailed");
	});

	it("sends the Google IDs and uses Play Games' ID-then-score order", async () => {
		jest.spyOn(TurboModuleRegistry, "get").mockReturnValue({});
		const games = androidGames();
		await games.unlockAchievement(GAME_ACHIEVEMENTS.PVP_FIGHT_COMPLETED);
		await games.submitTopweekScore(500);
		expect(GooglePlayGames.unlockAchievement).toHaveBeenCalledWith("google-pvp");
		expect(GooglePlayGames.submitScore).toHaveBeenCalledWith("google-topweek", 500);
	});

	it("keeps old native builds unavailable instead of pretending to synchronize", () => {
		jest.mocked(requireOptionalNativeModule).mockReturnValue(null);
		jest.spyOn(TurboModuleRegistry, "get").mockReturnValue(null);
		expect(iosGames().availability).toBe(GAME_SERVICE_AVAILABILITY.NATIVE_UNAVAILABLE);
		expect(androidGames().availability).toBe(GAME_SERVICE_AVAILABILITY.NATIVE_UNAVAILABLE);
	});
});