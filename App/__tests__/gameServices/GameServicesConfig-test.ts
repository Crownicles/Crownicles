import {AndroidConfig} from "expo/config-plugins";
import {configurePlayGamesManifest} from "../../plugins/withGameServices";
import {requireOptionalNativeModule} from "expo";
import {TurboModuleRegistry} from "react-native";
import GooglePlayGames from "react-native-google-play-games";
import {createPlatformGames as iosGames} from "@/src/gameServices/PlatformGames.ios";
import {createPlatformGames as androidGames} from "@/src/gameServices/PlatformGames.android";
import {GAME_ACHIEVEMENTS} from "@/src/gameServices/Achievements";
import {GAME_SERVICE_AVAILABILITY} from "@/src/gameServices/GameServicesTypes";

jest.mock("expo", () => ({requireOptionalNativeModule: jest.fn()}));
jest.mock("expo-constants", () => ({__esModule: true, default: {expoConfig: {extra: {gameServices: {
	gameCenter: {pvpAchievementId: "apple-pvp", topweekLeaderboardId: "apple-topweek"},
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
	afterEach(() => {jest.clearAllMocks(); jest.restoreAllMocks();});

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