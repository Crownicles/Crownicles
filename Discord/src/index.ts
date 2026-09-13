import {
	CrowniclesConfig, loadConfig
} from "./config/DiscordConfig";
import {
	Shard, ShardingManager
} from "discord.js";
import { AutoPoster as autoPoster } from "topgg-autoposter";
import { CrowniclesLogger } from "../../Lib/src/logs/CrowniclesLogger";
import { discordConfig } from "./bot/CrowniclesShard";
import { connect } from "mqtt";
import { MqttConstants } from "../../Lib/src/constants/MqttConstants";
import { MqttTopicUtils } from "../../Lib/src/utils/MqttTopicUtils";
import { DiscordConstants } from "./DiscordConstants";
import { ShardSpawnSupervisor } from "./utils/ShardSpawnSupervisor";

const shardCount = "auto";

// As shardingManager overrides old shards with the same IDs, we need to keep track of the spawned shards
let spawnedShards: Shard[] = [];

function startShardingManagerMqtt(config: CrowniclesConfig, shardingManager: ShardingManager, shardSpawnSupervisor: ShardSpawnSupervisor): void {
	const mqttClient = connect(discordConfig.MQTT_HOST, {
		connectTimeout: MqttConstants.CONNECTION_TIMEOUT
	});

	mqttClient.on("connect", () => {
		CrowniclesLogger.info("Connected to MQTT");
		const topic = MqttTopicUtils.getDiscordShardManagerTopic(config.PREFIX);
		mqttClient.publish(topic, "");
		mqttClient.subscribe(topic);
	});

	mqttClient.on("message", async (_topic, message) => {
		const messageString = message.toString();
		if (messageString.startsWith(DiscordConstants.MQTT.SHARD_DUPLICATED_MSG)) {
			const messageParts = messageString.split(":");
			const shardId = parseInt(messageParts[1], 10);
			CrowniclesLogger.info(`Shard ${shardId} is duplicated, killing all its instances`);
			let canReplaceShards = true;
			shardSpawnSupervisor.cancelRetry(shardId);

			// Kill all shards with the same ID
			spawnedShards.filter(shard => shard.id === shardId).forEach(shard => {
				if (!shard.process && !shard.worker) {
					return;
				}

				CrowniclesLogger.info(`Killing shard ${shardId}...`);
				if (shardSpawnSupervisor.killIntentionally(shard)) {
					CrowniclesLogger.info(`Shard ${shardId} killed`);
				}
				else {
					canReplaceShards = false;
				}
			});
			if (!canReplaceShards) {
				CrowniclesLogger.error(`Unable to replace duplicated shard ${shardId}; keeping the current instances`);
				return;
			}

			// Clean up spawned shards
			spawnedShards = spawnedShards.filter(shard => shard.id !== shardId);

			// Create a new shard with the same ID
			CrowniclesLogger.info(`Creating a new shard ${shardId}...`);
			let newShard: Shard | undefined;
			try {
				newShard = shardingManager.createShard(shardId);
				await newShard.spawn();
				CrowniclesLogger.info(`New shard ${shardId} created`);
			}
			catch (e) {
				CrowniclesLogger.errorWithObj(`Error while creating shard ${shardId}`, e);
				if (newShard) {
					shardSpawnSupervisor.handleSpawnFailure(newShard);
				}
			}
		}
	});
}

/**
 * Function executed when the bot starts
 */
function main(): void {
	const config = loadConfig();
	CrowniclesLogger.init(config.LOGGER_LEVEL, config.LOGGER_LOCATIONS, { app: "ShardManager" }, config.LOKI_HOST
		? {
			host: config.LOKI_HOST,
			username: config.LOKI_USERNAME,
			password: config.LOKI_PASSWORD
		}
		: undefined);

	const shardingManager = new ShardingManager("./dist/Discord/src/bot/CrowniclesShard.js", {
		totalShards: shardCount,
		respawn: false,

		// Needed as in auto mode it has to make a request to know the needed number of shards
		token: config.DISCORD_CLIENT_TOKEN
	});
	const shardSpawnSupervisor = new ShardSpawnSupervisor(config.DISCORD_CLIENT_TOKEN);

	startShardingManagerMqtt(config, shardingManager, shardSpawnSupervisor);

	shardingManager.on("shardCreate", shard => {
		shardSpawnSupervisor.watch(shard);
		shard.on("ready", () => CrowniclesLogger.info("Shard connected to Discord's Gateway"));
		shard.on("death", () => {
			spawnedShards = spawnedShards.filter(spawnedShard => spawnedShard !== shard);
		});
		shard.on("spawn", () => {
			if (!spawnedShards.includes(shard)) {
				spawnedShards.push(shard);
			}
			CrowniclesLogger.info(`Shard ${shard.id} created`);
			shard.send({
				type: "shardId",
				data: {
					shardId: shard.id,
					shardCount: shardingManager.totalShards
				}
			})
				.then();
		});
		shard.on("disconnect", () => {
			/*
			 * Recreate the shard because it often creates duplications
			 * This fix make the bot restart often. Let's keep it commented for now
			 */
			/*
			 * CrowniclesLogger.info(`Shard ${shard.id} disconnected, killing it and creating a new one...`);
			 * shard.kill();
			 * const newShard = shardingManager.createShard(shard.id);
			 * await newShard.spawn();
			 */

			CrowniclesLogger.error(`Shard ${shard.id} disconnected`);
		});
		shard.on("reconnecting", () => {
			/*
			 * Recreate the shard because it often creates duplications
			 * This fix make the bot restart often. Let's keep it commented for now
			 */
			/*
			 * CrowniclesLogger.info(`Shard ${shard.id} reconnecting, killing it and creating a new one...`);
			 * shard.kill();
			 * const newShard = shardingManager.createShard(shard.id);
			 * await newShard.spawn();
			 */

			CrowniclesLogger.error(`Shard ${shard.id} reconnecting`);
		});
		shard.on("error", err => CrowniclesLogger.errorWithObj(`Shard ${shard.id} error`, err));
	});

	// Auto posting stats to top.gg
	if (config.DBL_TOKEN !== "" && config.DBL_TOKEN !== "") {
		autoPoster(config.DBL_TOKEN, shardingManager)
			.on("posted", data => {
				CrowniclesLogger.info(`Successfully posted following data to DBL: ${data}`);
			});
	}

	shardingManager.spawn({
		amount: shardCount
	}).catch(e => {
		CrowniclesLogger.errorWithObj("Error while spawning shards", e);
	});
}

main();
