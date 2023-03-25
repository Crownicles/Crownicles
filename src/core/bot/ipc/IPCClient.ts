import RootIPC = require("node-ipc");
import {IPC} from "node-ipc";
import {botConfig, draftBotClient, draftBotInstance} from "../index";
import {TextChannel} from "discord.js";

// We need to use InstanceType because IPC is not exported
let ipc: InstanceType<typeof IPC> = null;
// We do not add extra steps which puts it back to 0 because we have 10^15 possibilities, we'll die before it reaches this
// The requestCount is used for packet ids
let requestCount = 0;

/*
 * This client sends a message to the server, but it cannot wait for an answer.
 * The solution is to store a callback associated with a packet id and when the server emits an answer with the same packet id we can call the callback
 */
const blockCallbacks: Map<number, (reason: string[]) => void> = new Map();
const spamCallbacks: Map<number, (spamming: boolean) => void> = new Map();

/**
 * Represents the client to manage blocking and unblocking the players on demand
 */
export class IPCClient {
	/**
	 * Creates a connection to the ipc server
	 * @param shardId
	 */
	static connectToIPCServer(shardId: number): void {
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		ipc = new RootIPC.IPCModule();
		ipc.config.id = `draftbot${shardId}`;
		ipc.config.retry = 1500;
		ipc.config.silent = true; // You can set this to false in order to debug, it's very useful

		ipc.connectTo("draftbot", function() {
			ipc.of.draftbot.on(
				"connect",
				function() {
					console.log(`## Shard ${shardId} connected to draftbot IPC ##`);
				}
			);
			ipc.of.draftbot.on(
				"disconnect",
				function() {
					// Clear the queue. Should not be called but it is in prevention
					blockCallbacks.forEach((value) => {
						value(null);
					});
					blockCallbacks.clear();
					spamCallbacks.forEach((value) => {
						value(false);
					});
					spamCallbacks.clear();
					console.log(`Shard ${shardId} disconnected from draftbot IPC`);
				}
			);
			ipc.of.draftbot.on(
				"isBlocked",
				function(data) {
					// Get the callback, delete it from the map and call the callback
					const callback = blockCallbacks.get(data.packet);
					blockCallbacks.delete(data.packet);
					callback(data.reason ?? null);
				}
			);
			ipc.of.draftbot.on(
				"isSpamming",
				function(data) {
					// Get the callback, delete it from the map and call the callback
					const callback = spamCallbacks.get(data.packet);
					spamCallbacks.delete(data.packet);
					callback(data.spamming);
				}
			);
			ipc.of.draftbot.on(
				"maintenance",
				function(data) {
					// Only execute it on the main server
					const guild = draftBotClient.guilds.cache.get(botConfig.MAIN_SERVER_ID);
					if (guild && guild.shard) {
						const channel = guild.channels.cache.get(botConfig.CONSOLE_CHANNEL_ID) as TextChannel;
						try {
							draftBotInstance.setMaintenance(data.enable, false);
							channel.send({ content: `Maintenance mode set from web server: ${data.enable}` }).then();
						}
						catch (err) {
							channel.send({ content: `Maintenance mode set from web server failed with error:\n\`\`\`${data.enable}\`\`\`` }).then();
						}
					}
				}
			);
		});
	}

	/**
	 * Block a player for a given reason and time
	 * @param discordId
	 * @param reason
	 * @param time
	 */
	static ipcBlockPlayer(discordId: string, reason: string, time = 0): void {
		ipc.of.draftbot.emit("block", {discordId, reason, time});
	}

	/**
	 * Unblock a player for a given reason
	 * @param discordId
	 * @param reason
	 */
	static ipcUnblockPlayer(discordId: string, reason: string): void {
		ipc.of.draftbot.emit("unblock", {discordId, reason});
	}

	/**
	 * Get all the reasons for why this player is blocked (empty list means it isn't blocked)
	 * @param discordId
	 */
	static ipcGetBlockedPlayerReason(discordId: string): Promise<string[]> {
		return new Promise(resolve => {
			blockCallbacks.set(requestCount, (reason) => resolve(reason));
			ipc.of.draftbot.emit("isBlocked", {packet: requestCount, discordId});
			requestCount++;
		});
	}

	/**
	 * Marks a player as a spammer
	 * @param discordId
	 */
	static ipcSpamBlockPlayer(discordId: string): void {
		ipc.of.draftbot.emit("spam", {discordId});
	}

	/**
	 * Checks if the player is spamming
	 * @param discordId
	 */
	static ipcIsPlayerSpamming(discordId: string): Promise<boolean> {
		return new Promise(resolve => {
			spamCallbacks.set(requestCount, (spamming) => resolve(spamming));
			ipc.of.draftbot.emit("isSpamming", {packet: requestCount, discordId});
			requestCount++;
		});
	}
}