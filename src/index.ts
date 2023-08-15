import {ShardingManager} from "discord.js";
import {loadConfig} from "./core/bot/DraftBotConfig";
import {IPCServer} from "./core/bot/ipc/IPCServer";
import AutoPoster from "topgg-autoposter";
import {initWebServer} from "./core/bot/DraftBotWebServer";

process.on("unhandledRejection", function(err: Error) {
	console.log(err);
	console.log(err.stack);
});

const shardCount = "auto";

/**
 * Function executed when the bot starts : Creates the shards and starts the IPC server
 */
function main(): void {
	const ipcServer = new IPCServer();

	const config = loadConfig();

	if (config.WEBSERVER_PORT && config.WEBSERVER_PORT !== 0) {
		initWebServer(config.WEBSERVER_PORT, ipcServer);
	}

	const shardingManager = new ShardingManager("./dist/src/core/bot/index.js", {
		totalShards: shardCount,
		// Needed as in auto mode it has to make a request to know the needed number of shards
		token: config.DISCORD_CLIENT_TOKEN
	});

	shardingManager.on("shardCreate", shard => {
		shard.on("ready", () => {
			console.log(`[DEBUG/SHARD] Shard ${shard.id} connected to Discord's Gateway.`);
			shard.send({type: "shardId", data: {shardId: shard.id}}).then();
		});
	});

	// Auto posting stats to top.gg
	if (config.DBL_TOKEN !== "" && config.DBL_TOKEN !== null) {
		// eslint-disable-next-line new-cap
		AutoPoster(config.DBL_TOKEN, shardingManager).on("posted", (data) => {
			console.log(`Successfully posted following data to DBL: ${data}`);
		});
	}

	shardingManager.spawn({
		amount: shardCount
	}).then();
}

main();