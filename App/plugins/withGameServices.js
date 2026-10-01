const {AndroidConfig, withAndroidManifest, withStringsXml} = require("expo/config-plugins");
const withGameCenterLocal = require("./withGameCenterLocal");

const PLAY_GAMES = {
	APP_ID_META: "com.google.android.gms.games.APP_ID",
	APP_ID_RESOURCE: "play_games_app_id",
	SUPPRESS_PROFILE_CREATION_META: "com.google.android.gms.games.SUPPRESS_GAME_PROFILE_CREATION",
	INIT_PROVIDER: "com.reactnativegoogleplaygames.GooglePlayGamesInitProvider",
	TOOLS_NAMESPACE: "http://schemas.android.com/tools"
};

function configurePlayGamesManifest(androidManifest, appId) {
	const application = AndroidConfig.Manifest.getMainApplicationOrThrow(androidManifest);
	application["meta-data"] = (application["meta-data"] || []).filter(entry => ![PLAY_GAMES.APP_ID_META, PLAY_GAMES.SUPPRESS_PROFILE_CREATION_META].includes(entry.$["android:name"]));
	application.provider = (application.provider || []).filter(entry => entry.$["android:name"] !== PLAY_GAMES.INIT_PROVIDER);
	if (!appId) {
		androidManifest.manifest.$["xmlns:tools"] = PLAY_GAMES.TOOLS_NAMESPACE;
		application.provider.push({$: {"android:name": PLAY_GAMES.INIT_PROVIDER, "tools:node": "remove"}});
		return androidManifest;
	}
	application["meta-data"].push(
		{$: {"android:name": PLAY_GAMES.APP_ID_META, "android:value": `@string/${PLAY_GAMES.APP_ID_RESOURCE}`}},
		{$: {"android:name": PLAY_GAMES.SUPPRESS_PROFILE_CREATION_META, "android:value": "true"}}
	);
	return androidManifest;
}

function withGameServices(config) {
	config = withGameCenterLocal(config);
	const appId = (config.extra?.gameServices?.playGames?.appId || "").trim();
	if (appId && !/^\d+$/.test(appId)) throw new Error("EXPO_PUBLIC_PLAY_GAMES_APP_ID must be a numeric Play Games project ID.");
	config = withAndroidManifest(config, mod => {
		mod.modResults = configurePlayGamesManifest(mod.modResults, appId);
		return mod;
	});
	return withStringsXml(config, mod => {
		if (appId) mod.modResults = AndroidConfig.Strings.setStringItem([{$: {name: PLAY_GAMES.APP_ID_RESOURCE, translatable: "false"}, _: appId}], mod.modResults);
		return mod;
	});
}

module.exports = withGameServices;
module.exports.configurePlayGamesManifest = configurePlayGamesManifest;