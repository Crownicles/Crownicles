const fs = require("fs");
const path = require("path");
const {Builder, parseStringPromise} = require("xml2js");
const {IOSConfig, withPodfileProperties, withXcodeProject} = require("expo/config-plugins");

const LOCAL_GAME_KIT = {
	MODE: "local",
	BUNDLE: "CrowniclesLocal.gamekit",
	SCHEME: "CrowniclesGameKitLocal",
	LAUNCH_MARKER: "CROWNICLES_GAMEKIT_LOCAL_TEST",
	FILE_TYPE: "com.apple.dt.gamekit"
};

/** Launches in debug with GameKit's local mode, and marks the launch so the app reads the bundled catalog */
function configureLaunch(launch) {
	launch.$.buildConfiguration = "Debug";
	launch.$.enableGameKitDebugMode = "YES";
	const variables = launch.EnvironmentVariables?.[0]?.EnvironmentVariable || [];
	launch.EnvironmentVariables = [{EnvironmentVariable: [
		...variables.filter(variable => variable.$?.key !== LOCAL_GAME_KIT.LAUNCH_MARKER),
		{$: {key: LOCAL_GAME_KIT.LAUNCH_MARKER, value: "1", isEnabled: "YES"}}
	]}];
}

/** The local scheme can never produce an archive that would reach the stores */
function preventArchiving(scheme) {
	const entries = scheme.BuildAction?.[0]?.BuildActionEntries?.[0]?.BuildActionEntry || [];
	for (const entry of entries) {
		entry.$.buildForArchiving = "NO";
	}
	delete scheme.ArchiveAction;
}

async function createLocalGameKitScheme(source) {
	const document = await parseStringPromise(source);
	const launch = document.Scheme?.LaunchAction?.[0];
	if (!launch?.$ || !launch.BuildableProductRunnable) throw new Error("GameKit local testing requires a runnable app scheme.");
	configureLaunch(launch);
	preventArchiving(document.Scheme);
	return new Builder().buildObject(document);
}

function addLocalBundle(project) {
	if (project.hasFile(LOCAL_GAME_KIT.BUNDLE)) return;
	const file = project.addFile(LOCAL_GAME_KIT.BUNDLE, project.getFirstProject().firstProject.mainGroup);
	project.pbxFileReferenceSection()[file.fileRef].lastKnownFileType = LOCAL_GAME_KIT.FILE_TYPE;
}

function withGameCenterLocal(config) {
	if (config.extra?.gameServices?.gameCenter?.mode !== LOCAL_GAME_KIT.MODE) return config;
	config = withPodfileProperties(config, mod => {
		mod.modResults["ios.buildReactNativeFromSource"] = "true";
		return mod;
	});
	return withXcodeProject(config, async mod => {
		const {projectRoot, platformProjectRoot} = mod.modRequest;
		const projectName = IOSConfig.XcodeUtils.getProjectName(projectRoot);
		const schemeDirectory = path.join(platformProjectRoot, `${projectName}.xcodeproj`, "xcshareddata", "xcschemes");
		const source = await fs.promises.readFile(path.join(schemeDirectory, `${projectName}.xcscheme`), "utf8");
		await fs.promises.cp(path.join(projectRoot, "game-services", LOCAL_GAME_KIT.BUNDLE), path.join(platformProjectRoot, LOCAL_GAME_KIT.BUNDLE), {recursive: true});
		addLocalBundle(mod.modResults);
		await fs.promises.writeFile(path.join(schemeDirectory, `${LOCAL_GAME_KIT.SCHEME}.xcscheme`), await createLocalGameKitScheme(source));
		return mod;
	});
}

module.exports = withGameCenterLocal;
module.exports.createLocalGameKitScheme = createLocalGameKitScheme;