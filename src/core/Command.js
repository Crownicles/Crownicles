import {DraftBotEmbed} from "./messages/DraftBotEmbed";
import {Entities} from "./models/Entity";
import {Guilds} from "./models/Guild";
import Server from "./models/Server";
import {botConfig, draftBotClient} from "./bot";
import {escapeUsername} from "./utils/StringUtils";
import {BlockingUtils} from "./utils/BlockingUtils";

const {readdir} = require("fs/promises");
const {readdirSync} = require("fs");

const {Collection} = require("discord.js");

/**
 * @class
 */
class Command {

	/**
	 * load all the commands from source files
	 * @return {Promise<void>}
	 */
	static async init() {
		Command.commands = new Collection();

		const categories = await readdir("dist/src/commands");
		categories.forEach(category => {
			const commandsFiles = readdirSync(`dist/src/commands/${category}`).filter(command => command.endsWith(".js"));
			for (const commandFile of commandsFiles) {
				const command = require(`../commands/${category}/${commandFile}`);
				Command.commands.set(command.commandInfo.name, command);
			}
		});
	}

	/**
	 * Get a command
	 * @param {String} commandName - The command to get
	 * @return An instance of the command asked
	 */
	static getCommand(commandName) {
		return Command.commands.get(commandName);
	}

	static getCommandFromAlias(alias) {
		return Command.commands.find(cmd => cmd.commandInfo.aliases && cmd.commandInfo.aliases.includes(alias));
	}

	/**
	 * This function analyses the passed message and check if he can be processed
	 * @param {module:"discord.js".Message} message - Message from the discord server
	 */
	static async handleMessage(message) {

		// server check :
		const [server] = await Server.findOrCreate({
			where: {
				discordGuildId: message.guild.id
			}
		});

		// language check
		let language = server.language;
		if (message.channel.id === JsonReader.app.ENGLISH_CHANNEL_ID) {
			language = LANGUAGE.ENGLISH;
		}

		// args loading
		const split = message.content.split(" ", 1);

		// if the bot is mentionned, send help message
		if (
			split.length > 0 &&
			split[0].match(discord.MessageMentions.USERS_PATTERN) &&
			split[0].includes(client.user.id)
		) {
			await message.channel.send({
				content:
					format(JsonReader.bot.getTranslation(language).mentionHelp, {
						prefix: server.prefix
					})
			});
			return;
		}
		if (message.mentions.has(client.user)) {
			return;
		}

		// otherwise continue
		const serverPrefixEquals = server.prefix === Command.getUsedPrefix(message, server.prefix);
		if (serverPrefixEquals || Command.getUsedPrefix(message, "sudo /usr/sbin/") === "sudo /usr/sbin/") {

			// check maintenance mode
			if (
				message.author.id !== JsonReader.app.BOT_OWNER_ID &&
				JsonReader.app.MODE_MAINTENANCE
			) {
				return message.channel.send({ embeds: [
					new DraftBotEmbed()
						.setDescription(JsonReader.bot.getTranslation(language).maintenance)
						.setTitle(":x: **Maintenance**")
						.setErrorColor()
				] });
			}
			await Command.launchCommand(language, serverPrefixEquals ? server.prefix : "sudo /usr/sbin/", message);
		}
		else if (
			Command.getUsedPrefix(
				message,
				JsonReader.app.BOT_OWNER_PREFIX
			) === JsonReader.app.BOT_OWNER_PREFIX &&
			message.author.id === JsonReader.app.BOT_OWNER_ID
		) {
			await Command.launchCommand(
				language,
				JsonReader.app.BOT_OWNER_PREFIX,
				message
			);
		}
	}

	/**
	 * This function analyses the passed private message and process it
	 * @param {module:"discord.js".Message} message - Message from the discord user
	 */
	static async handlePrivateMessage(message) {
		const [entity] = await Entities.getOrRegister(message.author.id);
		let icon = "";
		if (!entity.Player.dmNotification) {
			icon = JsonReader.bot.dm.alertIcon;
		}
		await draftBotClient.shard.broadcastEval((client, context) => {
			const mainServer = client.guilds.cache.get(context.mainServerId);
			if (mainServer) {
				const dmChannel = client.users.cache.get(context.dmChannelId);
				if (context.attachments.length > 0) {
					for (const attachment of context.attachments) {
						dmChannel.send({
							files: [{
								attachment: attachment.url,
								name: attachment.filename
							}]
						});
					}
				}
				dmChannel.send({ content: context.supportAlert });
			}
		}, {
			context: {
				mainServerId: botConfig.MAIN_SERVER_ID,
				dmChannelId: botConfig.SUPPORT_CHANNEL_ID,
				attachments: Array.from(message.attachments.values()),
				supportAlert: format(JsonReader.bot.dm.supportAlert, {
					username: escapeUsername(message.author.username),
					alertIcon: icon,
					id: message.author.id
				}) + message.content
			}
		});

		const msg = await sendSimpleMessage(
			message.author,
			message.channel,
			JsonReader.bot.dm.titleSupport,
			JsonReader.bot.dm.messageSupport
		);
		msg.react(MENU_REACTION.ENGLISH_FLAG);
		msg.react(MENU_REACTION.FRENCH_FLAG);

		const filterConfirm = (reaction) => reaction.me && !reaction.users.cache.last().bot;

		const collector = msg.createReactionCollector({
			filter: filterConfirm,
			time: COLLECTOR_TIME,
			max: 1
		});

		collector.on("collect", (reaction) => {
			const language =
				reaction.emoji.name === MENU_REACTION.ENGLISH_FLAG ? LANGUAGE.ENGLISH : LANGUAGE.FRENCH;
			sendSimpleMessage(
				message.author,
				message.channel,
				format(
					JsonReader.bot.getTranslation(language).dmHelpMessageTitle,
					{pseudo: escapeUsername(message.author.username)}
				),
				JsonReader.bot.getTranslation(language).dmHelpMessage
			);
		});
	}

	/**
	 * Get the prefix that the user just used to make the command
	 * @param {*} message - The message to extract the command from
	 * @param {String} prefix - The prefix used by current server
	 * @return {String}
	 */
	static getUsedPrefix(message, prefix) {
		return message.content.substr(0, prefix.length);
	}

	/**
	 *
	 * @param {*} message - A command posted by an user.
	 * @param {String} prefix - The current prefix in the message content
	 * @param {('fr'|'en')} language - The language for the current server
	 */
	static async launchCommand(language, prefix, message) {
		if (resetIsNow()) {
			return await sendErrorMessage(
				message.author,
				message.channel,
				language,
				JsonReader.bot.getTranslation(language).resetIsNow
			);
		}

		const args = message.content.slice(prefix.length).trim()
			.split(/ +/g);

		const commandName = args.shift().toLowerCase();

		const command = this.getCommand(commandName) || this.getCommandFromAlias(commandName);

		if (!command) {
			return;
		}
		if (
			!message.channel.permissionsFor(client.user).serialize()
				.SEND_MESSAGES
		) {
			try {
				await message.author.send({
					content:
					JsonReader.bot.getTranslation(language).noSpeakPermission
				});
			}
			catch (err) {
				log("No perms to show i can't react in server / channel : " + message.guild + "/" + message.channel);
			}
			return;
		}
		if (
			!message.channel.permissionsFor(client.user).serialize()
				.ADD_REACTIONS
		) {
			try {
				await message.author.send({
					content:
					JsonReader.bot.getTranslation(language).noReacPermission
				});
			}
			catch (err) {
				await message.channel.send({
					content:
					JsonReader.bot.getTranslation(language).noReacPermission
				});
			}
			return;
		}
		if (
			!message.channel.permissionsFor(client.user).serialize()
				.EMBED_LINKS
		) {
			try {
				await message.author.send({
					content:
					JsonReader.bot.getTranslation(language).noEmbedPermission
				});
			}
			catch (err) {
				await message.channel.send({
					content:
					JsonReader.bot.getTranslation(language).noEmbedPermission
				});
			}
			return;
		}
		if (
			!message.channel.permissionsFor(client.user).serialize()
				.ATTACH_FILES
		) {
			try {
				await message.author.send({
					content:
					JsonReader.bot.getTranslation(language).noFilePermission
				});
			}
			catch (err) {
				await message.channel.send({
					content:
					JsonReader.bot.getTranslation(language).noFilePermission
				});
			}
			return;
		}

		const [entity] = await Entities.getOrRegister(message.author.id);
		if (command.commandInfo.requiredLevel && entity.Player.getLevel() < command.commandInfo.requiredLevel) {
			return await sendErrorMessage(
				message.author,
				message.channel,
				language,
				format(JsonReader.error.getTranslation(language).levelTooLow, {
					pseudo: entity.getMention(),
					level: command.commandInfo.requiredLevel
				})
			);
		}

		if (command.commandInfo.disallowEffects && command.commandInfo.disallowEffects.includes(entity.Player.effect) && !entity.Player.currentEffectFinished()) {
			return effectsErrorMe(message, language, entity, entity.Player.effect);
		}

		if (command.commandInfo.allowEffects && !command.commandInfo.allowEffects.includes(entity.Player.effect) && !entity.Player.currentEffectFinished()) {
			return effectsErrorMe(message, language, entity, entity.Player.effect);
		}

		if (await canPerformCommand(message, language, command.commandInfo.userPermissions, command.commandInfo.restrictedEffects, entity) !== true) {
			return;
		}

		if (command.commandInfo.guildRequired) {
			let guild;

			try {
				guild = await Guilds.getById(entity.Player.guildId);
			}
			catch (error) {
				guild = null;
			}

			if (guild === null) {
				// not in a guild
				return sendErrorMessage(message.author, message.channel, language, JsonReader.commands.guildDaily.getTranslation(language).notInAGuild);
			}

			let userPermissionsLevel = 1;

			if (entity.id === guild.getElderId()) {
				userPermissionsLevel = 2;
			}
			if (entity.id === guild.getChiefId()) {
				userPermissionsLevel = 3;
			}

			if (userPermissionsLevel < command.commandInfo.guildPermissions) {
				return sendErrorMessage(
					message.author,
					message.channel,
					language,
					JsonReader.commands.guildDescription.getTranslation(language)
						.notAuthorizedError
				);
			}
		}

		if (await BlockingUtils.isPlayerSpamming(message.author.id)) {
			return sendErrorMessage(
				message.author,
				message.channel,
				language,
				JsonReader.error.getTranslation(language).blockedContext["cooldown"]);
		}

		BlockingUtils.spamBlockPlayer(message.author.id);

		log(message.author.id + " executed in server " + message.guild.id + ": " + message.content.substr(1));
		await command.execute(message, language, args);
	}
}

/**
 * @type {{init: Command.init}}
 */
module
	.exports = {
		init: Command.init
	};

global
	.getCommand = Command.getCommand;
global
	.handleMessage = Command.handleMessage;
global
	.handlePrivateMessage = Command.handlePrivateMessage;
global
	.getCommandFromAlias = Command.getCommandFromAlias;
global
	.getAliasesFromCommand = Command.getAliasesFromCommand;
