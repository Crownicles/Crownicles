const { withAppDelegate } = require("expo/config-plugins");

/**
 * Since the SDK that follows iOS 26, UIKit terminates at launch any app that does not adopt the
 * UIScene life cycle (Apple TN3187). `ExpoAppSceneDelegate`, declared in the scene manifest of
 * app.json, creates the window and starts React Native, so the app delegate must stop doing it
 * and expose its factory through `ExpoReactNativeFactoryProvider`.
 *
 * The Expo template still generates the pre-scene app delegate, so this runs on every prebuild.
 */

const PROVIDER_CONFORMANCE = {
	from: "class AppDelegate: ExpoAppDelegate {",
	to: "class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {"
};

const WINDOW_CREATION = /\n#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\([\s\S]*?\n#endif\n/;

function adoptSceneLifecycle(contents) {
	if (contents.includes(PROVIDER_CONFORMANCE.to)) {
		return contents;
	}
	if (!contents.includes(PROVIDER_CONFORMANCE.from) || !WINDOW_CREATION.test(contents)) {
		throw new Error(
			"withSceneLifecycle: the generated AppDelegate no longer matches the expected template. "
			+ "Check whether Expo now adopts the UIScene life cycle itself before removing this plugin: "
			+ "without the adoption the app is terminated at launch by iOS."
		);
	}
	return contents
		.replace(PROVIDER_CONFORMANCE.from, PROVIDER_CONFORMANCE.to)
		.replace(WINDOW_CREATION, "\n");
}

module.exports = config => withAppDelegate(config, appDelegate => {
	appDelegate.modResults.contents = adoptSceneLifecycle(appDelegate.modResults.contents);
	return appDelegate;
});
