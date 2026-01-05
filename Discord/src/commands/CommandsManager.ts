import { ICommand } from "./ICommand";
import {
	ActionRowBuilder,
	AnyThreadChannel,
	ApplicationCommand,
	ApplicationCommandOptionType,
	Attachment,
	AttachmentBuilder,
	AutocompleteInteraction,
	ButtonBuilder,
	ButtonInteraction,
	ButtonStyle,
	ChannelType,
	Client,
	CommandInteraction,
	GuildResolvable,
	Message,
	MessageType,
	PermissionsBitField,
	REST,
	RouteLike,
	Snowflake
} from "discord.js";
import {
	RESTPostAPIChatInputApplicationCommandsJSONBody, Routes
} from "discord-api-types/v10";
import {
	crowniclesClient, discordConfig, keycloakConfig
} from "../bot/CrowniclesShard";
import { KeycloakUser } from "../../../Lib/src/keycloak/KeycloakUser";
import { readdirSync } from "fs";
import i18n from "../translations/i18n";
import { replyEphemeralErrorMessage } from "../utils/ErrorUtils";
import { Constants } from "../../../Lib/src/constants/Constants";
import { CrowniclesEmbed } from "../messages/CrowniclesEmbed";
import { escapeUsername } from "../../../Lib/src/utils/StringUtils";
import { KeycloakUtils } from "../../../Lib/src/keycloak/KeycloakUtils";
import {
	CrowniclesChannel, CrowniclesInteraction
} from "../messages/CrowniclesInteraction";
import { DiscordCache } from "../bot/DiscordCache";
import { BotUtils } from "../utils/BotUtils";
import {
	Language, LANGUAGE
} from "../../../Lib/src/Language";
import { PacketUtils } from "../utils/PacketUtils";
import { CrowniclesIcons } from "../../../Lib/src/CrowniclesIcons";
import { DiscordConstants } from "../DiscordConstants";
import { CrowniclesLogger } from "../../../Lib/src/logs/CrowniclesLogger";
import { disableRows } from "../utils/DiscordCollectorUtils";
import {
	clearPendingDeletion,
	extractDeletionCode,
	getConfirmationPhrase,
	getPendingDeletion,
	isValidConfirmationPhrase,
	setPendingDeletion,
	verifyDeletionCode
} from "../utils/AccountDeletionUtils";

export class CommandsManager {
	static commands = new Map<string, ICommand>();

	static commandsInstances = new Map<string, ApplicationCommand>();


	/**
	 * Register the bot at launch
	 * @param client
	 * @param isMainShard
	 */
	static async register(client: Client, isMainShard: boolean): Promise<void> {
		await this.registerAllCommands(client, isMainShard);

		this.manageInteractionCreate(client);

		this.manageMessageCreate(client);
	}

	/**
	 * Register all commands that should be registered
	 * @param clientId
	 * @param commands
	 * @param regFunc
	 */
	static async registerCommands(clientId: Snowflake, commands: RESTPostAPIChatInputApplicationCommandsJSONBody[], regFunc: (clientId: Snowflake, serverId: Snowflake) => RouteLike): Promise<void> {
		const rest = new REST({ version: "10" }).setToken(discordConfig.DISCORD_CLIENT_TOKEN);
		try {
			CrowniclesLogger.info(`Started refreshing ${commands.length} application (/) commands.`);
			const data = await rest.put(
				regFunc(clientId, discordConfig.MAIN_SERVER_ID),
				{ body: commands }
			);
			if (Array.isArray(data)) {
				CrowniclesLogger.info(`Successfully reloaded ${data.length} application (/) commands.`);
			}
			else {
				CrowniclesLogger.error("Failed to reload commands", { data });
			}
		}
		catch (error) {
			// And of course, make sure you catch and log any errors!
			CrowniclesLogger.errorWithObj("Failed to reload commands", error);
		}
	}

	/**
	 * Register all commands at launch
	 * @param client
	 * @param isMainShard
	 */
	static async registerAllCommands(client: Client, isMainShard: boolean): Promise<void> {
		try {
			const allCommandToRegister = await this.getAllCommandsToRegister();
			if (isMainShard) {
				await CommandsManager.registerCommands(client.application!.id, allCommandToRegister[1], Routes.applicationGuildCommands);
				await CommandsManager.registerCommands(client.application!.id, allCommandToRegister[0], Routes.applicationCommands);
			}
			await this.refreshCommands(client);
		}
		catch (e) {
			CrowniclesLogger.errorWithObj("Failed to register commands", e);

			// Do not start the bot if we can't register the commands
			process.exit(1);
		}
	}

	/**
	 * Execute all the important checks upon receiving a private message
	 * @param message
	 */
	static async handlePrivateMessage(message: Message | CommandInteraction): Promise<void> {
		const author = message instanceof Message ? message.author.id : message.user.id;
		if (author === discordConfig.DM_MANAGER_ID) {
			return;
		}

		// Handle account deletion flow for regular messages
		if (message instanceof Message) {
			const deletionHandled = await this.handleAccountDeletionDM(message);
			if (deletionHandled) {
				return;
			}
			await this.sendBackDMMessageToSupportChannel(message);
		}
		await this.sendHelperMessage(message);
	}

	/**
	 * Handle account deletion DM messages
	 * Returns true if the message was handled as part of the deletion flow
	 * @param message
	 */
	private static async handleAccountDeletionDM(message: Message): Promise<boolean> {
		const authorId = message.author.id;
		const content = message.content.trim();

		// Check if user has a pending deletion and is typing the confirmation phrase
		const pending = getPendingDeletion(authorId);
		if (pending) {
			if (isValidConfirmationPhrase(content)) {
				// User confirmed - proceed with account deletion (delete Keycloak user completely)
				const result = await KeycloakUtils.deleteUser(keycloakConfig, pending.keycloakId);
				clearPendingDeletion(authorId);

				if (result.isError) {
					await message.reply(i18n.t("bot:accountDeletion.error", { lng: pending.language }));
					CrowniclesLogger.error(`Failed to delete user ${pending.keycloakId}: status=${result.status}, payload=${JSON.stringify(result.payload)}`);
				}
				else {
					await message.reply(i18n.t("bot:accountDeletion.success", { lng: pending.language }));
					CrowniclesLogger.info(`Successfully deleted Keycloak user ${pending.keycloakId} (Discord: ${authorId})`);
				}
				return true;
			}

			// User sent something else while pending - cancel and inform
			clearPendingDeletion(authorId);
			await message.reply(i18n.t("bot:accountDeletion.cancelled", { lng: pending.language }));
			return true;
		}

		// Check if user is initiating deletion with "DELETE ACCOUNT <code>"
		const code = extractDeletionCode(content);
		if (code) {
			// Look up the user in Keycloak
			const user = await KeycloakUtils.getDiscordUser(keycloakConfig, authorId, message.author.displayName);
			if (user.isError || !user.payload.user) {
				await message.reply(i18n.t("bot:accountDeletion.userNotFound", { lng: LANGUAGE.FRENCH }));
				return true;
			}

			// Verify the code matches
			const userLanguage = KeycloakUtils.getUserLanguage(user.payload.user);
			if (!verifyDeletionCode(user.payload.user.id, code)) {
				await message.reply(i18n.t("bot:accountDeletion.invalidCode", { lng: userLanguage }));
				return true;
			}

			// Code is valid - ask for confirmation phrase
			const confirmationPhrase = getConfirmationPhrase(userLanguage);

			setPendingDeletion(authorId, user.payload.user.id, userLanguage);

			await message.reply(i18n.t("bot:accountDeletion.confirmPrompt", {
				lng: userLanguage,
				phrase: confirmationPhrase
			}));
			return true;
		}

		return false;
	}

	/**
	 * Get the list of commands to register
	 */
	public static async getAllCommandsToRegister(): Promise<RESTPostAPIChatInputApplicationCommandsJSONBody[][]> {
		const categories = readdirSync("dist/Discord/src/commands");
		const globalCommandsToRegister: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];
		const guildsCommandsToRegister: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];
		const commandsToCheck = [];
		for (const category of categories) {
			if (category.endsWith(".js") || category.endsWith(".js.map")) {
				continue;
			}
			commandsToCheck.push(this.checkCommandFromCategory(category, globalCommandsToRegister, guildsCommandsToRegister));
		}
		await Promise.all(commandsToCheck);
		return [globalCommandsToRegister, guildsCommandsToRegister];
	}

	/**
	 * Get all commands to register and store them in the relevant maps
	 * @param client
	 */
	private static async refreshCommands(client: Client): Promise<void> {
		CrowniclesLogger.info("Fetching and saving commands...");
		const commands = (await client.application!.commands.fetch({ withLocalizations: true }))
			.concat(await (await client.guilds.fetch(discordConfig.MAIN_SERVER_ID)).commands.fetch({ withLocalizations: true }));

		// Store command instances
		for (const command of commands) {
			CommandsManager.commandsInstances.set(command[1].name, command[1]);
			this.addSubCommandsToTheCommandsMentions(command);
			BotUtils.commandsMentions.set(command[1].name, `</${command[1].name}:${command[0]}>`);
		}
	}

	/**
	 * Check if a command has subcommands and add them to the commandsMentions map
	 * @param command
	 */
	private static addSubCommandsToTheCommandsMentions(command: [string, ApplicationCommand<{
		guild: GuildResolvable;
	}>]): void {
		if (command[1].options) {
			for (const option of command[1].options) {
				if (option.type === ApplicationCommandOptionType.Subcommand) {
					BotUtils.commandsMentions.set(`${command[1].name} ${option.name}`, `</${command[1].name} ${option.name}:${command[0]}>`);
				}
			}
		}
	}

	/**
	 * Push the commands to check from a given category
	 * @param category
	 * @param globalCommandsToRegister
	 * @param guildsCommandsToRegister
	 */
	private static async checkCommandFromCategory(
		category: string,
		globalCommandsToRegister: RESTPostAPIChatInputApplicationCommandsJSONBody[],
		guildsCommandsToRegister: RESTPostAPIChatInputApplicationCommandsJSONBody[]
	): Promise<void> {
		let commandsFiles = readdirSync(`dist/Discord/src/commands/${category}`)
			.filter(command => command.endsWith(".js"));
		if (!discordConfig.TEST_MODE) {
			commandsFiles = commandsFiles.filter(command => !command.startsWith("Test"));
		}
		for (const commandFile of commandsFiles) {
			const commandInfo = (await import(`./${category}/${commandFile}`)).commandInfo as ICommand;
			if (!commandInfo?.slashCommandBuilder) {
				CrowniclesLogger.error(`Command dist/Discord/src/commands/${category}/${commandFile} is not a slash command`);
				continue;
			}
			this.commands.set(commandInfo.slashCommandBuilder.name, commandInfo);
			if (commandInfo.mainGuildCommand || discordConfig.TEST_MODE) {
				guildsCommandsToRegister.push(commandInfo.slashCommandBuilder.toJSON());
				CrowniclesLogger.info(`Registering guild command ${category}/${commandFile}`);
			}
			else {
				globalCommandsToRegister.push(commandInfo.slashCommandBuilder.toJSON());
				CrowniclesLogger.info(`Registering global command ${category}/${commandFile}`);
			}
		}
	}

	/**
	 * Manage the creation of a message from channels the bot have access to
	 * @param client
	 */
	private static manageMessageCreate(client: Client): void {
		client.on("messageCreate", async message => {
			// Ignore all bot messages and own messages
			if (this.isAMessageFromBotOrEmpty(message)) {
				return;
			}
			if (message.channel.type === ChannelType.DM) {
				await CommandsManager.handlePrivateMessage(message);
				return;
			}
			if (this.isAMessageFromMassOrMissPing(message) || !this.shouldSendHelpMessage(message, client)) {
				return;
			}
			const user = await KeycloakUtils.getDiscordUser(keycloakConfig, message.author.id, escapeUsername(message.author.displayName));
			message.channel.send({
				content: `${i18n.t("bot:mentionHelp", {
					lng: !user.isError ? KeycloakUtils.getUserLanguage(user.payload.user) : LANGUAGE.DEFAULT_LANGUAGE
				})}`
			})
				.then();
		});
	}

	/**
	 * Check if the bot has the right and the permissions to send messages in the channel of the received message
	 * @param message
	 * @param client
	 */
	private static shouldSendHelpMessage(message: Message, client: Client): boolean {
		return message.mentions.has(client.user!.id) && this.hasChannelPermission(message.channel as unknown as CrowniclesChannel)[0];
	}

	/**
	 * Check if the received message is a mass ping or a miss ping from a reply
	 * @param message
	 */
	private static isAMessageFromMassOrMissPing(message: Message): boolean {
		return message.content.includes("@here") || message.content.includes("@everyone") || message.type === MessageType.Reply;
	}

	/**
	 * Check if the message comes from a bot (itself or another one) or if it's content is empty in case it's not a DM
	 * @param message
	 */
	private static isAMessageFromBotOrEmpty(message: Message): boolean {
		return message.author.bot || message.author.id === crowniclesClient!.user!.id || !message.content && message.channel.type !== ChannelType.DM;
	}

	/**
	 * Handle autocomplete interactions for commands
	 * @param interaction
	 */
	private static async handleAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
		try {
			const command = CommandsManager.commands.get(interaction.commandName);

			if (command?.handleAutocomplete) {
				await command.handleAutocomplete(interaction);
			}
			else {
				// No autocomplete handler defined, respond with empty array
				await interaction.respond([]);
			}
		}
		catch (error) {
			CrowniclesLogger.errorWithObj(`Error while handling autocomplete for ${interaction.commandName}`, error);

			// Try to respond with empty array to prevent Discord errors
			try {
				await interaction.respond([]);
			}
			catch {
				// Interaction already responded or timed out
			}
		}
	}

	/**
	 * Manage the slash commands from where the bot is asked
	 * @param client
	 */
	private static manageInteractionCreate(client: Client): void {
		client.on("interactionCreate", async discordInteraction => {
			// Handle autocomplete interactions
			if (discordInteraction.isAutocomplete()) {
				CommandsManager.handleAutocomplete(discordInteraction)
					.then();
				return;
			}

			if (!discordInteraction.isCommand() || discordInteraction.user.bot || discordInteraction.user.id === crowniclesClient!.user!.id) {
				return;
			}
			const interaction: CrowniclesInteraction = CrowniclesInteraction.cast(discordInteraction);
			const getUser = await KeycloakUtils.getOrRegisterDiscordUser(
				keycloakConfig,
				discordInteraction.user.id,
				escapeUsername(discordInteraction.user.displayName),
				discordInteraction.locale.substring(0, 2)
			);
			if (getUser.isError) {
				const errorLng = discordInteraction.locale.substring(0, 2);
				replyEphemeralErrorMessage(
					null,
					interaction,
					i18n.t("error:errorOccurred", { lng: (LANGUAGE.LANGUAGES as string[]).includes(errorLng) ? errorLng as Language : LANGUAGE.DEFAULT_LANGUAGE })
				)
					.finally(() => null);
				CrowniclesLogger.error("Error while getting user", { apiResult: getUser });
				return;
			}
			const lng = KeycloakUtils.getUserLanguage(getUser.payload.user);
			interaction.userLanguage = lng;
			if (!interaction.channel) {
				replyEphemeralErrorMessage(
					null,
					interaction,
					i18n.t("bot:noChannelAccess", { lng })
				)
					.finally(() => null);
				return;
			}
			if (!interaction.member) { // If in DM, shouldn't happen
				CommandsManager.handlePrivateMessage(discordInteraction)
					.finally(() => null);
				return;
			}
			CommandsManager.handleCommand(interaction, getUser.payload.user)
				.then();
		});
	}

	/**
	 * Sends back a message sent in the bot DMs to the support channel
	 * @param message
	 */
	private static async sendBackDMMessageToSupportChannel(message: Message): Promise<void> {
		await crowniclesClient!.users.fetch(discordConfig.DM_MANAGER_ID)
			.then(async user => {
				const attachmentList: (Attachment | AttachmentBuilder)[] = Array.from(message.attachments.values());
				if (message.content.length > Constants.DM.MAX_MESSAGE_LENGTH_ALLOWED) {
					attachmentList.push(new AttachmentBuilder(Buffer.from(message.content)).setName(`userMessage-${message.author.id}-${message.id}.txt`));
				}
				const supportAlert = i18n.t("bot:supportAlert", {
					lng: LANGUAGE.FRENCH,
					username: escapeUsername(message.author.displayName),
					id: message.author.id
				}) + (message.content.length > Constants.DM.MAX_MESSAGE_LENGTH_ALLOWED
					? Constants.DM.TOO_LONG_MESSAGE
					: message.content.length === 0
						? Constants.DM.NO_MESSAGE
						: Constants.DM.COMMENT_MESSAGE_START + message.content);
				await user.send({
					content: supportAlert,
					files: attachmentList.slice(0, Constants.DM.MAX_ATTACHMENTS)
				});
				for (let i = 1; i < attachmentList.length / Constants.DM.MAX_ATTACHMENTS; i++) {
					await user.send({
						content: "",
						files: attachmentList.slice(i * Constants.DM.MAX_ATTACHMENTS, (i + 1) * Constants.DM.MAX_ATTACHMENTS)
					});
				}
			})
			.catch(e => CrowniclesLogger.warn("Could not find a place to forward the DM message", e));
	}

	/**
	 * Sends a support message to the user, either if they sent a message in DM or if they used a command in DM
	 * @param message
	 * @param title
	 * @param descTrKey
	 */
	private static async sendSupportMessage(message: Message | CommandInteraction, title: string, descTrKey: string): Promise<void> {
		const author = message instanceof Message ? message.author : message.user;
		const sendMessage = message instanceof CommandInteraction ? message.followUp.bind(message) : message.author.send.bind(message.author);

		const row = [new ActionRowBuilder<ButtonBuilder>()];
		let desc = "";

		for (const lng of [LANGUAGE.FRENCH, LANGUAGE.ENGLISH]) {
			desc += `${i18n.t(descTrKey, {
				lng,
				langFlag: CrowniclesIcons.languages[lng]
			})}\n`;
		}

		for (const lng of LANGUAGE.LANGUAGES) {
			if (row[row.length - 1].components.length >= DiscordConstants.MAX_BUTTONS_PER_ROW) {
				row.push(new ActionRowBuilder<ButtonBuilder>());
			}

			row[row.length - 1].addComponents(
				new ButtonBuilder()
					.setEmoji(CrowniclesIcons.languages[lng])
					.setCustomId(lng)
					.setStyle(ButtonStyle.Secondary)
			);
		}

		const supportMessage = new CrowniclesEmbed()
			.formatAuthor(title, author)
			.setDescription(desc);

		const msg = await message.reply({
			embeds: [supportMessage],
			content: Constants.DM.INVITE_LINK,
			components: row
		});

		const collector = msg.createMessageComponentCollector({
			filter: interaction => interaction instanceof ButtonInteraction,
			time: Constants.MESSAGES.COLLECTOR_TIME
		});

		collector.on("collect", async (buttonInteraction: ButtonInteraction) => {
			collector.stop();

			const lng = buttonInteraction.customId as Language;
			await sendMessage({
				embeds: [
					new CrowniclesEmbed()
						.formatAuthor(i18n.t("bot:dmHelpMessageTitle", {
							lng
						}), author)
						.setDescription(i18n.t("bot:dmHelpMessage", { lng }))
				]
			});
		});

		collector.on("end", async () => {
			disableRows(row);

			await msg.edit({ components: row });
		});
	}

	/**
	 * Sends a message to someone who said something in DM to the bot
	 * @param message
	 */
	private static async sendHelperMessage(message: Message | CommandInteraction): Promise<void> {
		if (message instanceof Message) {
			await CommandsManager.sendSupportMessage(message, Constants.DM.TITLE_SUPPORT, "bot:supportMessage");
		}
		else {
			await CommandsManager.sendSupportMessage(message, Constants.DM.TITLE_SUPPORT, "bot:commandDisabledInDM");
		}
	}

	/**
	 * Checks for the maintenance mode
	 * @param interaction the interaction to reply to
	 * @param user
	 */
	private static async handleCommand(interaction: CrowniclesInteraction, user: KeycloakUser): Promise<void> {
		const lng = interaction.userLanguage;

		const commandInfo = this.commands.get(interaction.commandName);

		if (!commandInfo) {
			await replyEphemeralErrorMessage(null, interaction, i18n.t("bot:command404", { lng }));
			CrowniclesLogger.error(`Command "${interaction.commandName}" is not registered`);
			return;
		}

		const channelAccess = this.hasChannelPermission(interaction.channel);
		if (!channelAccess[0]) {
			await replyEphemeralErrorMessage(null, interaction, i18n.t(channelAccess[1], { lng }));
			return;
		}

		DiscordCache.cacheInteraction(interaction);
		const packet = await commandInfo.getPacket(interaction, user);
		if (packet) {
			const context = await PacketUtils.createPacketContext(interaction, user);
			PacketUtils.sendPacketToBackend(context, packet);
		}
	}

	/**
	 * Check if the bot has every needed permission in the channel where the command is launched
	 * @param channel
	 */
	private static hasChannelPermission(channel: CrowniclesChannel): [boolean, string] {
		if (!channel.permissionsFor(crowniclesClient!.user!)
			?.has(PermissionsBitField.Flags.ViewChannel)) {
			CrowniclesLogger.error(`No way to access the channel where the command has been executed : ${channel.guildId}/${channel.id}`);
			return [false, "noChannelAccess"];
		}

		if (!channel.permissionsFor(crowniclesClient!.user!)
			?.has(PermissionsBitField.Flags.SendMessages)) {
			CrowniclesLogger.error(`No way to send messages in the channel where the command has been executed : ${channel.guildId}/${channel.id}`);
			return [false, "noSpeakPermission"];
		}

		if (!channel.permissionsFor(crowniclesClient!.user!)
			?.has(PermissionsBitField.Flags.SendMessagesInThreads) && channel.isThread()) {
			const thread = channel as AnyThreadChannel;
			CrowniclesLogger.error(`No way to send messages in the thread where the command has been executed : ${thread.guildId}/${thread.id}`);
			return [false, "noSpeakInThreadPermission"];
		}

		if (!channel.permissionsFor(crowniclesClient!.user!)
			?.has(PermissionsBitField.Flags.AddReactions)) {
			CrowniclesLogger.error(`No perms to show i can't react in server / channel : ${channel.guildId}/${channel.id}`);
			return [false, "noReacPermission"];
		}

		if (!channel.permissionsFor(crowniclesClient!.user!)
			?.has(PermissionsBitField.Flags.EmbedLinks)) {
			CrowniclesLogger.error(`No perms to show i can't embed in server / channel : ${channel.guildId}/${channel.id}`);
			return [false, "noEmbedPermission"];
		}

		if (!channel.permissionsFor(crowniclesClient!.user!)
			?.has(PermissionsBitField.Flags.AttachFiles)) {
			CrowniclesLogger.error(`No perms to show i can't attach files in server / channel : ${channel.guildId}/${channel.id}`);
			return [false, "noFilePermission"];
		}

		if (!channel.permissionsFor(crowniclesClient!.user!)
			?.has(PermissionsBitField.Flags.ReadMessageHistory)) {
			CrowniclesLogger.error(`No perms to show i can't see messages history in server / channel : ${channel.guildId}/${channel.id}`);
			return [false, "noHistoryPermission"];
		}

		return [true, ""];
	}
}
