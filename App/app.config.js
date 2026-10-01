const fs = require("fs");
const os = require("os");
const path = require("path");

/**
 * The Firebase file names the project Android pushes go through. It stays out of the repository:
 * a build without it works the same, only without notifications while the app is closed.
 */
const GOOGLE_SERVICES_FILE = [
	process.env.GOOGLE_SERVICES_JSON,
	path.join(__dirname, "google-services.json"),
	path.join(os.homedir(), ".crownicles", "google-services.json")
].find(file => file && fs.existsSync(file));

module.exports = ({config}) => ({
	...config,
	...(GOOGLE_SERVICES_FILE ? {android: {...config.android, googleServicesFile: GOOGLE_SERVICES_FILE}} : {}),
	extra: {
		...config.extra,
		gameServices: {
			gameCenter: {
				pvpAchievementId: process.env.EXPO_PUBLIC_GAME_CENTER_PVP_ACHIEVEMENT_ID || "com.crownicles.app.pvp_fight_completed",
				topweekLeaderboardId: process.env.EXPO_PUBLIC_GAME_CENTER_TOPWEEK_LEADERBOARD_ID || "com.crownicles.app.topweek_best"
			},
			playGames: {
				appId: process.env.EXPO_PUBLIC_PLAY_GAMES_APP_ID || "",
				pvpAchievementId: process.env.EXPO_PUBLIC_PLAY_GAMES_PVP_ACHIEVEMENT_ID || "",
				topweekLeaderboardId: process.env.EXPO_PUBLIC_PLAY_GAMES_TOPWEEK_LEADERBOARD_ID || ""
			}
		}
	}
});
