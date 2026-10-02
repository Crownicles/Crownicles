import {spawnSync} from "node:child_process";
import path from "node:path";
import {fileURLToPath} from "node:url";

const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ACTIONS = {PREPARE: "prepare", METRO: "metro"};
const LOCAL_PORT = "8084";
const environment = {
	...process.env,
	NODE_ENV: "development",
	EXPO_PUBLIC_GAME_CENTER_MODE: "local",
	CROWNICLES_EXPO_HOST: process.env.CROWNICLES_EXPO_HOST || "lan",
	CROWNICLES_EXPO_PORT: LOCAL_PORT
};

function run(command, args) {
	const result = spawnSync(command, args, {cwd: APP_ROOT, env: environment, stdio: "inherit"});
	if (result.error) throw result.error;
	if (result.status !== 0) process.exit(result.status ?? 1);
}

const action = process.argv[2];
if (action === ACTIONS.PREPARE) {
	run("pnpm", ["exec", "expo", "prebuild", "--platform", "ios", "--no-install"]);
	run("pod", ["install", "--project-directory=ios"]);
	console.log("Ready: open ios/Crownicles.xcworkspace in Xcode, choose CrowniclesGameKitLocal and run on a physical iPhone.");
}
else if (action === ACTIONS.METRO) {
	run("zsh", ["scripts/start-mobile.sh", "--ios", "--dev-client", ...process.argv.slice(3)]);
}
else {
	console.error("Usage: node scripts/gamekit-local.mjs prepare|metro");
	process.exit(1);
}