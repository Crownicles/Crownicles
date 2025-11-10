import {
	Client, Guild, IntentsBitField, Partials, TextChannel
} from "discord.js";
import { Constants } from "../../../Lib/src/constants/Constants";
import { loadConfig } from "../config/DiscordConfig";
import i18n from "../translations/i18n";
import { BotUtils } from "../utils/BotUtils";
import { KeycloakConfig } from "../../../Lib/src/keycloak/KeycloakConfig";
import { CommandsManager } from "../commands/CommandsManager";
import { DiscordMQTT } from "./DiscordMQTT";
import {
	LANGUAGE, Language
} from "../../../Lib/src/Language";
import { DiscordDatabase } from "../database/discord/DiscordDatabase";
import { CrowniclesDiscordWebServer } from "./CrowniclesDiscordWebServer";
import { CrowniclesLogger } from "../../../Lib/src/logs/CrowniclesLogger";
import {
	makePacket, PacketContext
} from "../../../Lib/src/packets/CrowniclesPacket";
import { CommandTestListPacketReq } from "../../../Lib/src/packets/commands/CommandTestListPacket";
import { PacketUtils } from "../utils/PacketUtils";
import "source-map-support/register";

process.on("uncaughtException", error => {
	console.error(`Uncaught exception: ${error}`);
	if (CrowniclesLogger.isInitialized()) {
		CrowniclesLogger.errorWithObj("Uncaught exception", error);
	}
});

process.on("unhandledRejection", error => {
	console.error(`Unhandled rejection: ${error}`);
	if (CrowniclesLogger.isInitialized()) {
		CrowniclesLogger.errorWithObj("Unhandled rejection", error);
	}
});

export let crowniclesClient!: Client;
export const discordConfig = loadConfig();
export const keycloakConfig: KeycloakConfig = {
	realm: discordConfig.KEYCLOAK_REALM,
	url: discordConfig.KEYCLOAK_URL,
	clientId: discordConfig.KEYCLOAK_CLIENT_ID,
	clientSecret: discordConfig.KEYCLOAK_CLIENT_SECRET
};
export let shardId = -1;
let shardCount = -1;
export const discordDatabase = new DiscordDatabase();

process.on("message", (message: {
	type: string;
	data: {
		shardId: number;
		shardCount: number;
	};
}) => {
	if (!message.type) {
		return false;
	}

	if (message.type === "shardId") {
		shardId = message.data.shardId;
		shardCount = message.data.shardCount;
		CrowniclesLogger.init(discordConfig.LOGGER_LEVEL, discordConfig.LOGGER_LOCATIONS, {
			app: "Discord",
			shard: shardId.toString(10)
		}, discordConfig.LOKI_HOST
			? {
				host: discordConfig.LOKI_HOST,
				username: discordConfig.LOKI_USERNAME,
				password: discordConfig.LOKI_PASSWORD
			}
			: undefined);
		CrowniclesLogger.info(`Starting shard ${shardId} (shards total: ${shardCount})`);
		connectAndStartBot().then();
	}
	return true;
});

/**
 * Request the list of test commands from Core for autocomplete
 */
function requestTestCommandsList(): void {
	try {
		const packet = makePacket(CommandTestListPacketReq, {});
		const context: PacketContext = {
			frontEndOrigin: "discord",
			frontEndSubOrigin: "system",
			discord: {
				shardId,
				user: "",
				interaction: "",
				channel: "",
				language: LANGUAGE.ENGLISH
			}
		};
		PacketUtils.sendPacketToBackend(context, packet);
		CrowniclesLogger.info("Requested test commands list from Core");
	}
	catch (error) {
		CrowniclesLogger.errorWithObj("Failed to request test commands list", error);
	}
}

export abstract class Intents {
	static readonly LIST =
		[
			IntentsBitField.Flags.Guilds, // We need it for roles
			IntentsBitField.Flags.GuildMembers, // For tops
			/*
			 * IntentsBitField.Flags.GuildBans, // We do not need to ban anyone
			 * IntentsBitField.Flags.GuildEmojisAndStickers, // We do not need to manage emojis nor stickers
			 * IntentsBitField.Flags.GuildIntegrations, // we do not need to manage integrations
			 * IntentsBitField.Flags.GuildWebhooks, // We do not need webhook
			 * IntentsBitField.Flags.GuildInvites, // We do not need to manage guild invites
			 * IntentsBitField.Flags.GuildVoiceStates, // We do not need to manage voice channels
			 * IntentsBitField.Flags.GuildPresences, // We do not need to manage presences
			 */
			IntentsBitField.Flags.GuildMessages, // We need to receive, send, update and delete messages
			IntentsBitField.Flags.GuildMessageReactions, // We need to add reactions
			// IntentsBitField.Flags.GuildMessageTyping, // We do not need to see who's typing
			IntentsBitField.Flags.DirectMessages, // We need to send and receive direct messages
			IntentsBitField.Flags.DirectMessageReactions // We need to receive direct messages reaction
			/*
			 * IntentsBitField.Flags.DirectMessageTyping, // We do not need to see who is currently writing to the bots dms
			 * IntentsBitField.Flags.MessageContent, // We do not need to manage other's message content
			 * IntentsBitField.Flags.GuildScheduledEvents // We do not need to see a guild's events
			 */
		];
}

/**
 * The main function of the bot : makes the bot start
 */
async function connectAndStartBot(): Promise<void> {
	const client = new Client(
		{
			intents: Intents.LIST,
			allowedMentions: { parse: ["users", "roles"] },
			partials: [Partials.Message, Partials.Channel],
			rest: {
				offset: 0,
				timeout: Constants.MAX_TIME_BOT_RESPONSE
			},
			shardCount,
			shards: [shardId]
		}
	);

	/**
	 * Get the message when the bot joins or leaves a guild
	 * @param guild
	 * @param join
	 * @param lng
	 * @returns
	 */
	function getJoinLeaveMessage(guild: Guild, join: boolean, lng: Language): string {
		const {
			validation,
			humans,
			bots,
			ratio
		} = BotUtils.getValidationInfos(guild);
		return i18n.t(join ? "bot:joinGuild" : "bot:leaveGuild", {
			guild: guild.name,
			humans,
			robots: bots,
			ratio,
			validation,
			lng
		});
	}

	/**
	 * Will be executed each time the bot join a new server
	 * @param guild
	 */
	function onDiscordGuildCreate(guild: Guild): void {
		const msg = getJoinLeaveMessage(guild, true, LANGUAGE.ENGLISH);
		CrowniclesLogger.info(msg);
	}

	/**
	 * Will be executed each time the bot leave a server
	 * @param guild
	 */
	function onDiscordGuildDelete(guild: Guild): void {
		const msg = getJoinLeaveMessage(guild, false, LANGUAGE.ENGLISH);
		CrowniclesLogger.info(msg);
	}

	client.on("ready", () => console.log("Bot is ready"));
	client.on("guildCreate", onDiscordGuildCreate);
	client.on("guildDelete", onDiscordGuildDelete);

	crowniclesClient = client;

	await client.login(discordConfig.DISCORD_CLIENT_TOKEN).catch(error => {
		console.error("Error while logging in the bot", error);
		process.exit(1);
	});

	CrowniclesDiscordWebServer.start(shardId);
	const isMainShard = shardId === 0;
	await CommandsManager.register(crowniclesClient, isMainShard);
	await DiscordMQTT.init(isMainShard);
	await discordDatabase.init(isMainShard);

	// Request test commands list from Core for autocomplete
	if (isMainShard) {
		requestTestCommandsList();
	}

	const guild = crowniclesClient?.guilds.cache.get(discordConfig.MAIN_SERVER_ID);
	if (guild?.shard) {
		(await guild.channels.fetch(discordConfig.CONSOLE_CHANNEL_ID) as TextChannel)
			.send(`:robot: **Crownicles** - v${process.env.npm_package_version} - Shard ${shardId}`)
			.catch(e => {
				CrowniclesLogger.errorWithObj("Error while sending message to console channel", e);
			});
	}
}

