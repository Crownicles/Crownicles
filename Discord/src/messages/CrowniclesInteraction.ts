import {
	BaseGuildTextChannel,
	BaseMessageOptions,
	BooleanCache,
	ButtonInteraction,
	Client,
	CommandInteraction,
	CommandInteractionOptionResolver,
	DiscordjsError,
	DiscordjsErrorCodes,
	GuildTextBasedChannel,
	InteractionCallbackResponse,
	InteractionEditReplyOptions,
	InteractionReplyOptions,
	InteractionResponse,
	Message,
	MessageCreateOptions,
	MessagePayload,
	StringSelectMenuInteraction
} from "discord.js";
import i18n from "../translations/i18n";
import {
	LANGUAGE, Language
} from "../../../Lib/src/Language";
import { CrowniclesEmbed } from "./CrowniclesEmbed";
import { CrowniclesLogger } from "../../../Lib/src/logs/CrowniclesLogger";
import {
	MessageFlags,
	type APIWebhook,
	type GatewayInteractionCreateDispatchData,
	type RESTGetAPIWebhookWithTokenResult
} from "discord-api-types/v10";
import { DiscordConstants } from "../DiscordConstants";

type RawInteractionData = GatewayInteractionCreateDispatchData;
type RawWebhookData = APIWebhook | RESTGetAPIWebhookWithTokenResult | (Partial<APIWebhook> & Required<Pick<APIWebhook, "id" | "guild_id">>);

type CrowniclesInteractionWithoutSendCommands = new(client: Client<true>, data: RawInteractionData) => Omit<CommandInteraction, "reply" | "followUp" | "channel" | "editReply">;
const CrowniclesInteractionWithoutSendCommands: CrowniclesInteractionWithoutSendCommands = CommandInteraction as unknown as CrowniclesInteractionWithoutSendCommands;

type ChannelTypeWithoutSend = new(client: Client<true>, data: RawWebhookData) => Omit<BaseGuildTextChannel, "send">;
const ChannelTypeWithoutSend: ChannelTypeWithoutSend = BaseGuildTextChannel as unknown as ChannelTypeWithoutSend;

type ReplyFunctionLike<OptionValue> = (options: OptionValue) => Promise<SendResult<OptionValue> | null>;

type SendResult<OptionValue> = OptionValue extends InteractionReplyOptions
	? OptionValue extends { withResponse: true }
		? InteractionCallbackResponse
		: InteractionResponse<BooleanCache<"cached">>
	: Message;

type Fallback = () => void | Promise<void>;

const NO_FALLBACK: Fallback = (): void => {
	// Nothing to do when the message could not be sent
};

/**
 * Method used to display a message in answer to an interaction
 */
export enum SendManner {
	SEND = "SEND",
	REPLY = "REPLY",
	FOLLOWUP = "FOLLOWUP",
	EDIT_REPLY = "EDIT_REPLY"
}

/**
 * Content of a message displayable by every send manner
 */
export type CrowniclesResponseOptions = Pick<BaseMessageOptions, "content" | "embeds" | "components" | "files"> & {

	/**
	 * Only show the message to the user, when the manner allows it: a reply or a follow-up
	 */
	ephemeral?: boolean;
};

/**
 * How to display a response: a manner forced by the caller, and what to do if the message could not be sent
 */
type RespondSettings = {
	manner?: SendManner;
	fallback?: Fallback;
};

export class CrowniclesInteraction extends CrowniclesInteractionWithoutSendCommands {
	public userLanguage: Language = LANGUAGE.DEFAULT_LANGUAGE;

	public options!: CommandInteractionOptionResolver;

	private _channel!: CrowniclesChannel;

	/**
	 * Get the channel of the interaction
	 */
	get channel(): CrowniclesChannel {
		return this._channel;
	}

	/**
	 * Cast a discord.js interaction to a CrowniclesInteraction. The interaction keeps its discord.js prototype: the
	 * methods of this class are bound to it one by one, those which are not are unavailable at runtime
	 * @param discordInteraction
	 * @param userLanguage - Language to display the messages in, when it is already known
	 */
	static cast(discordInteraction: CommandInteraction | ButtonInteraction | StringSelectMenuInteraction, userLanguage?: Language): CrowniclesInteraction {
		if (discordInteraction === null) {
			throw new Error("CrowniclesInteraction casting: discordInteraction is null.");
		}

		// @ts-expect-error - We aim at changing the signature of the followUp function to allow it to return null
		discordInteraction.followUp = CrowniclesInteraction.prototype.followUp.bind(discordInteraction);

		// @ts-expect-error - We aim at changing the signature of the reply function to add a fallback parameter, so ts is not happy with it
		discordInteraction.reply = CrowniclesInteraction.prototype.reply.bind(discordInteraction);

		// @ts-expect-error - We aim at changing the signature of the editReply function to allow it to return null
		discordInteraction.editReply = CrowniclesInteraction.prototype.editReply.bind(discordInteraction);

		const interaction = discordInteraction as unknown as CrowniclesInteraction;
		interaction.replyWithMessage = CrowniclesInteraction.prototype.replyWithMessage.bind(interaction);
		interaction.respond = CrowniclesInteraction.prototype.respond.bind(interaction);
		if (userLanguage) {
			interaction.userLanguage = userLanguage;
		}

		// The channel is null when it is not cached: a click must still reach Core then
		if (discordInteraction.channel) {
			interaction._channel = CrowniclesChannel.cast(discordInteraction.channel as GuildTextBasedChannel);
		}
		if (discordInteraction.isCommand() && "options" in discordInteraction) {
			interaction.options = this.properCastOptions(discordInteraction.options as CommandInteractionOptionResolver);
		}
		return interaction;
	}

	/**
	 * Properly cast the options of the interaction to add missing functions and throw explicit errors when trying to use unavailable functions
	 *
	 * LAST DISCORD.JS UPDATE CHECKED: 14.15.3
	 * @param options
	 */

	private static properCastOptions(options: CommandInteractionOptionResolver): CommandInteractionOptionResolver {
		// Not present in class AutoCompleteInteraction | MessageContextMenuInteraction
		// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
		options.getUser ??= () => {
			throw new Error("CrowniclesInteraction: interaction.options.getUser is not defined for this interaction.");
		};

		// Not present in class AutoCompleteInteraction
		// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
		options.getMember ??= () => {
			throw new Error("CrowniclesInteraction: interaction.options.getMember is not defined for this interaction.");
		};

		// Not present in class ChatInputCommandInteraction | AutocompleteInteraction | UserContextMenuCommandInteraction
		// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
		options.getMessage ??= () => {
			throw new Error("CrowniclesInteraction: interaction.options.getMessage is not defined for this interaction.");
		};

		// Not present in class ChatInputCommandInteraction | MessageContextMenuInteraction | UserContextMenuCommandInteraction
		// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
		options.getFocused ??= () => {
			throw new Error("CrowniclesInteraction: interaction.options.getFocused is not defined for this interaction.");
		};

		// Not present in AutoCompleteInteraction | UserContextMenuCommandInteraction
		// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
		options.getChannel ??= () => {
			throw new Error(
				"CrowniclesInteraction: interaction.options.getChannel is not defined for this interaction."
			);
		};

		// Not present in class AutoCompleteInteraction | MessageContextMenuInteraction | UserContextMenuCommandInteraction
		// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
		options.getAttachment ??= () => {
			throw new Error(
				"CrowniclesInteraction: interaction.options.getAttachment is not defined for this interaction."
			);
		};

		// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
		options.getMentionable ??= () => {
			throw new Error(
				"CrowniclesInteraction: interaction.options.getMentionable is not defined for this interaction."
			);
		};

		// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
		options.getRole ??= () => {
			throw new Error(
				"CrowniclesInteraction: interaction.options.getRole is not defined for this interaction."
			);
		};

		// Not present in class MessageContextMenuInteraction | UserContextMenuCommandInteraction
		// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
		options.getNumber ??= () => {
			throw new Error(
				"CrowniclesInteraction: interaction.options.getNumber is not defined for this interaction."
			);
		};

		// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
		options.getInteger ??= () => {
			throw new Error(
				"CrowniclesInteraction: interaction.options.getInteger is not defined for this interaction."
			);
		};

		// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
		options.getString ??= () => {
			throw new Error(
				"CrowniclesInteraction: interaction.options.getString is not defined for this interaction."
			);
		};

		// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
		options.getBoolean ??= () => {
			throw new Error(
				"CrowniclesInteraction: interaction.options.getBoolean is not defined for this interaction."
			);
		};

		// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
		options.getSubcommandGroup ??= () => {
			throw new Error(
				"CrowniclesInteraction: interaction.options.getSubcommandGroup is not defined for this interaction."
			);
		};

		// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
		options.getSubcommand ??= () => {
			throw new Error(
				"CrowniclesInteraction: interaction.options.getSubcommand is not defined for this interaction."
			);
		};

		return options;
	}

	/**
	 * Send a reply to the user. Its response is not a message, and collectors created on it mix everything up: use
	 * {@link replyWithMessage} to collect the components of the reply
	 * @param options classic discord.js send options
	 * @param fallback function to execute if the bot can't send the message
	 */
	public async reply(options: string | MessagePayload | InteractionReplyOptions & {
		withResponse?: false;
	}, fallback?: Fallback): Promise<Omit<InteractionResponse, "createMessageComponentCollector"> | null> {
		return await (CrowniclesInteraction.prototype.commonSendCommand<typeof options>).call(
			this,
			(CommandInteraction.prototype.reply as ReplyFunctionLike<typeof options>).bind(this),
			options,
			fallback ?? NO_FALLBACK
		) as Omit<InteractionResponse, "createMessageComponentCollector"> | null;
	}

	/**
	 * Send a reply to the user and get its message (#3386)
	 * @param options classic discord.js send options
	 * @param fallback function to execute if the bot can't send the message
	 */
	public async replyWithMessage(options: InteractionReplyOptions, fallback?: Fallback): Promise<Message | null> {
		type ReplyWithResponseOptions = InteractionReplyOptions & { withResponse: true };
		const response = await (CrowniclesInteraction.prototype.commonSendCommand<ReplyWithResponseOptions>).call(
			this,
			(CommandInteraction.prototype.reply as ReplyFunctionLike<ReplyWithResponseOptions>).bind(this),
			{
				...options,
				withResponse: true
			},
			fallback ?? NO_FALLBACK
		);
		return response?.resource?.message ?? null;
	}

	/**
	 * Display a message in answer to the interaction (#2730). Without a forced manner, the method is the one the state of
	 * the interaction still allows: the reply before any acknowledgement, the deferred reply while it waits for its
	 * content, a follow-up once answered
	 * @param options content of the message
	 * @param settings manner forced by the caller and function to execute if the bot can't send the message
	 */
	public async respond(options: CrowniclesResponseOptions, {
		manner, fallback
	}: RespondSettings = {}): Promise<Message | null> {
		const {
			ephemeral, ...content
		} = options;
		const ephemeralFlags = ephemeral ? { flags: MessageFlags.Ephemeral } as const : {};
		switch (manner ?? CrowniclesInteraction.getAvailableSendManner(this)) {
			case SendManner.REPLY:
				return await CrowniclesInteraction.prototype.replyWithMessage.call(this, {
					...content, ...ephemeralFlags
				}, fallback);
			case SendManner.FOLLOWUP:
				return await this.followUp({
					...content, ...ephemeralFlags
				}, fallback);
			case SendManner.EDIT_REPLY:
				return await this.editReply(content, fallback);
			default:
				return await this.channel.send(content, fallback);
		}
	}

	/**
	 * The only manner Discord still accepts to answer the interaction in its current state
	 * @param interaction
	 */
	private static getAvailableSendManner(interaction: CrowniclesInteraction): Exclude<SendManner, SendManner.SEND> {
		if (interaction.replied) {
			return SendManner.FOLLOWUP;
		}
		return interaction.deferred ? SendManner.EDIT_REPLY : SendManner.REPLY;
	}

	/**
	 * Send a followUp to the user
	 * @param options classic discord.js send options
	 * @param fallback function to execute if the bot can't send the message
	 */
	public async followUp(options: string | InteractionReplyOptions | MessagePayload, fallback?: Fallback): Promise<Message | null> {
		return await (CrowniclesInteraction.prototype.commonSendCommand<string | MessagePayload | InteractionReplyOptions>).call(
			this,
			CommandInteraction.prototype.followUp.bind(this),
			options,
			fallback ?? NO_FALLBACK
		) as Message;
	}

	private _isV2 = false;

	private static isV2FlaggedOptions(options: string | MessagePayload | InteractionEditReplyOptions): boolean {
		return typeof options === "object"
			&& !(options instanceof MessagePayload)
			&& "flags" in options
			&& Array.isArray(options.flags)
			&& options.flags.includes("IsComponentsV2");
	}

	public async editReply(options: string | MessagePayload | InteractionEditReplyOptions, fallback?: Fallback): Promise<Message | null> {
		// Track V2 state — once set, the flag cannot be removed from the message
		if (CrowniclesInteraction.isV2FlaggedOptions(options)) {
			this._isV2 = true;
		}

		/*
		 * When message is V2 and caller sends legacy content, use followUp instead
		 * to avoid conflicts — V2 flag is permanent and cannot be removed
		 */
		if (this._isV2 && !CrowniclesInteraction.isV2FlaggedOptions(options)) {
			return await this.followUp(options as InteractionReplyOptions, fallback);
		}
		return await (CrowniclesInteraction.prototype.commonSendCommand<string | MessagePayload | InteractionEditReplyOptions>).call(
			this,
			CommandInteraction.prototype.editReply.bind(this),
			options,
			fallback ?? NO_FALLBACK
		) as Message;
	}

	/**
	 * Send a message to the user
	 * @param functionPrototype reply or followUp function
	 * @param options classic discord.js send options
	 * @param fallback function to execute if the bot can't send the message
	 */
	private async commonSendCommand<OptionType>(
		functionPrototype: ReplyFunctionLike<OptionType>,
		options: OptionType,
		fallback: Fallback
	): Promise<SendResult<OptionType> | null> {
		try {
			return await functionPrototype(options);
		}
		catch (e) {
			CrowniclesLogger.errorWithObj("An error occurred during a send, either a permission issue or a send/reply/followUp/editReply conflict", e);
			await CrowniclesInteraction.prototype.manageFallback.bind(this)(functionPrototype, e as Error);
			await fallback();
			return null;
		}
	}

	/**
	 * Manage the fallback of both reply and followUp functions
	 */
	private async manageFallback<OptionType>(
		functionPrototype: ReplyFunctionLike<OptionType>,
		e: Error
	): Promise<void> {
		// Check if the command timeout-ed and then ignore
		if (
			e?.constructor.name === "DiscordAPIError"
			&& (e as unknown as { code: number }).code === 10062
			&& !this.deferred
			&& this.createdTimestamp + DiscordConstants.COMMAND_TIMEOUT_MS < Date.now()
		) {
			return;
		}

		// Error codes due to a development mistake, and not because of a weird permission error
		const manageFallbackDevErrorCodes = [
			DiscordjsErrorCodes.InteractionAlreadyReplied,
			DiscordjsErrorCodes.InteractionNotReplied
		];

		let toSendProp: {
			content?: string; embeds?: CrowniclesEmbed[];
		};
		const lng = this.userLanguage;
		if (e?.constructor.name === DiscordjsError.name && manageFallbackDevErrorCodes.includes((e as DiscordjsError).code)) {
			toSendProp = {
				embeds: [
					new CrowniclesEmbed()
						.formatAuthor(i18n.t("error:errorOccurredTitle", { lng }), this.user)
						.setDescription(i18n.t("error:aDevMessedUp", { lng }))
						.setErrorColor()
				]
			};
		}
		else {
			toSendProp = { content: i18n.t("bot:noSpeakPermission", { lng }) };
		}
		try {
			// @ts-expect-error - We consider that the functionPrototype is a function that can be called with these parameters (i.e, accepts a InteractionReplyOptions)
			await functionPrototype.call(this, {
				flags: MessageFlags.Ephemeral,
				...toSendProp
			});
		}
		catch {
			// Try again to manage fallback with the send function
			if (functionPrototype !== CrowniclesChannel.prototype.send) {
				await CrowniclesInteraction.prototype.manageFallback.bind(this)(BaseGuildTextChannel.prototype.send.bind(this.channel), e);
				return;
			}

			// We can't send ephemeral message, so we send the message in DM
			try {
				await CommandInteraction.prototype.user.send.bind(this.user)({ ...toSendProp });
			}
			catch (e) {
				CrowniclesLogger.errorWithObj(`Unable to alert user of no speak permission : c:${this.channel?.id} / u:${this.user?.id}`, e);
			}
		}
	}
}

export class CrowniclesChannel extends ChannelTypeWithoutSend {
	// @ts-expect-error - Property 'language' starts undefined and is initialized if we are sure the channel is a valid channel
	public language: Language;

	/**
	 * Cast a GuildTextBasedChannel to a CrowniclesChannel
	 * @param channel
	 */
	static cast(channel: GuildTextBasedChannel): CrowniclesChannel {
		// @ts-expect-error - We aim at changing the signature of the send function to add a fallback parameter, so ts is not happy with it
		channel.send = CrowniclesChannel.prototype.send.bind(channel);
		return channel as unknown as CrowniclesChannel;
	}

	/**
	 * Send a message to the channel
	 * @param options classic discord.js send options
	 * @param fallback function to execute if the bot can't send the message
	 */
	public async send(options: string | MessageCreateOptions, fallback?: Fallback): Promise<Message | null> {
		try {
			return await BaseGuildTextChannel.prototype.send.bind(this)(options);
		}
		catch (e) {
			CrowniclesLogger.errorWithObj("Weird Permission Error", e);
			CrowniclesChannel.prototype.manageFallback.bind(this)();
			await (fallback ?? NO_FALLBACK)();
			return null;
		}
	}

	/**
	 * Manage the fallback of the send function
	 */
	private manageFallback(): void {
		// We can't send ephemeral message nor send messages in DM
		CrowniclesLogger.error(`Unable to alert user of no speak permission : c:${this.id} / u:N/A`);
	}
}
