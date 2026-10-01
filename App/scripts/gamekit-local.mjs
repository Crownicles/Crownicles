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
	EXPO_PUBLIC_REST_API_URL: process.env.EXPO_PUBLIC_REST_API_URL || "https://alpha-api.crownicles.com",
	EXPO_PUBLIC_WEBSOCKET_URL: process.env.EXPO_PUBLIC_WEBSOCKET_URL || "wss://alpha-ws.crownicles.com",
	EXPO_PUBLIC_KEYCLOAK_URL: process.env.EXPO_PUBLIC_KEYCLOAK_URL || "https://alpha-auth.crownicles.com",
	EXPO_PUBLIC_KEYCLOAK_REALM: process.env.EXPO_PUBLIC_KEYCLOAK_REALM || "Crownicles",
	EXPO_PUBLIC_KEYCLOAK_CLIENT_ID: process.env.EXPO_PUBLIC_KEYCLOAK_CLIENT_ID || "crownicles-app"
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
	run("pnpm", ["exec", "expo", "start", "--dev-client", "--lan", "--port", LOCAL_PORT]);
}
else {
	console.error("Usage: node scripts/gamekit-local.mjs prepare|metro");
	process.exit(1);
}