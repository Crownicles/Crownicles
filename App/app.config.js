const fs = require("fs");
const os = require("os");
const path = require("path");
const localGameKitCatalog = require("./game-services/CrowniclesLocal.gamekit/gameCenterResources.json");

const gameCenterMode = process.env.EXPO_PUBLIC_GAME_CENTER_MODE || "disabled";
if (!["disabled", "local", "production"].includes(gameCenterMode)) {
	throw new Error("EXPO_PUBLIC_GAME_CENTER_MODE must be disabled, local or production.");
}

/**
 * The Firebase file names the project Android pushes go through. It stays out of the repository:
 * a build without it works the same, only without notifications while the app is closed.
 */
const GOOGLE_SERVICES_FILE = [
	process.env.GOOGLE_SERVICES_JSON,
	path.join(__dirname, "google-services.json"),
	path.join(os.homedir(), ".crownicles", "google-services.json")
].find(file => file && fs.existsSync(file));

function env(name, fallback = "") {
	return process.env[name] || fallback;
}

/** A local GameKit build reads its identifiers from the bundled catalog instead of App Store Connect */
function gameCenterConfig(mode) {
	if (mode === "local") {
		const {achievements, leaderboards} = localGameKitCatalog.resources;
		return {mode, pvpAchievementId: achievements[0].vendorIdentifier, topweekLeaderboardId: leaderboards[0].vendorIdentifier};
	}
	return {
		mode,
		pvpAchievementId: env("EXPO_PUBLIC_GAME_CENTER_PVP_ACHIEVEMENT_ID", "com.crownicles.app.pvp_fight_completed"),
		topweekLeaderboardId: env("EXPO_PUBLIC_GAME_CENTER_TOPWEEK_LEADERBOARD_ID", "com.crownicles.app.topweek_best")
	};
}

function playGamesConfig() {
	return {
		appId: env("EXPO_PUBLIC_PLAY_GAMES_APP_ID"),
		pvpAchievementId: env("EXPO_PUBLIC_PLAY_GAMES_PVP_ACHIEVEMENT_ID"),
		topweekLeaderboardId: env("EXPO_PUBLIC_PLAY_GAMES_TOPWEEK_LEADERBOARD_ID")
	};
}

function androidConfig(android) {
	return GOOGLE_SERVICES_FILE ? {android: {...android, googleServicesFile: GOOGLE_SERVICES_FILE}} : {};
}

module.exports = ({config}) => ({
	...config,
	...androidConfig(config.android),
	extra: {
		...config.extra,
		gameServices: {
			gameCenter: gameCenterConfig(gameCenterMode),
			playGames: playGamesConfig()
		}
	}
});
