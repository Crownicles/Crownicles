const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const wsPacketsRoot = path.resolve(projectRoot, "../WsPackets");

const config = getDefaultConfig(projectRoot);

// ws-packets is linked from the repository instead of being published, so Metro must watch and resolve it outside of App/
config.watchFolders = [wsPacketsRoot];
config.resolver.nodeModulesPaths = [
	path.resolve(projectRoot, "node_modules"),
	path.resolve(wsPacketsRoot, "node_modules")
];

module.exports = config;
