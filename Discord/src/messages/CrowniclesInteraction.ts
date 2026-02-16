import {
	BaseGuildTextChannel,
	BooleanCache,
	ButtonInteraction,
	Client,
	CommandInteraction,
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
import {
	RawInteractionData, RawWebhookData
} from "discord.js/typings/rawDataTypes";
import i18n from "../translations/i18n";
import {
	LANGUAGE, Language
} from "../../../Lib/src/Language";
import { CommandInteractionOptionResolver } from "discord.js/typings";
import { CrowniclesEmbed } from "./CrowniclesEmbed";
import { CrowniclesLogger } from "../../../Lib/src/logs/CrowniclesLogger";
import { MessageFlags } from "discord-api-types/v10";
import { DiscordConstants } from "../DiscordConstants";

type CrowniclesInteractionWithoutSendCommands = new(client: Client<true>, data: RawInteractionData) => Omit<CommandInteraction, "reply" | "followUp" | "channel" | "editReply">;
const CrowniclesInteractionWithoutSendCommands: CrowniclesInteractionWithoutSendCommands = CommandInteraction as unknown as CrowniclesInteractionWithoutSendCommands;

type ChannelTypeWithoutSend = new(client: Client<true>, data: RawWebhookData) => Omit<BaseGuildTextChannel, "send">;
const GuildTextBasedChannel: GuildTextBasedChannel = BaseGuildTextChannel as unknown as GuildTextBasedChannel;
const ChannelTypeWithoutSend: ChannelTypeWithoutSend = GuildTextBasedChannel as unknown as ChannelTypeWithoutSend;

export type ReplyFunctionLike<OptionValue> = (options: OptionValue) => Promise<ReturnType<OptionValue> | null>;

type ReturnType<OptionValue> = OptionValue extends InteractionReplyOptions
	? OptionValue extends { withResponse: true }
		? InteractionCallbackResponse
		: InteractionResponse<BooleanCache<"cached">>
	: Message;

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

	private _replyEdited = false;

	public get replyEdited(): boolean {
		return this._replyEdited;
	}

	/**
	 * Cast a CommandInteraction to a CrowniclesInteraction
	 * @param discordInteraction
	 */
	static cast(discordInteraction: CommandInteraction | ButtonInteraction | StringSelectMenuInteraction): CrowniclesInteraction {
		if (discordInteraction === null) {
			throw new Error("CrowniclesInteraction casting: discordInteraction is null.");
		}

		// @ts-expect-error - We aim at changing the signature of the followUp function to allow it to return null
		discordInteraction.followUp = CrowniclesInteraction.prototype.followUp.bind(discordInteraction);

		// @ts-expect-error - We aim at changing the signature of the reply function to add a fallback parameter, so ts is not happy with it
		discordInteraction.reply = CrowniclesInteraction.prototype.reply.bind(discordInteraction);

		// @ts-expect-error - We aim at changing the signature of the editReply function to allow it to return null
		discordInteraction.editReply = CrowniclesInteraction.prototype.editReply.bind(discordInteraction);

		/*
		 * Make deferReply idempotent to prevent Unknown interaction errors when Core takes > 3s
		 */
		const originalDeferReply = discordInteraction.deferReply.bind(discordInteraction);

		// @ts-expect-error - We change the return type to void since callers never use the return value
		discordInteraction.deferReply = async (): Promise<void> => {
			if (discordInteraction.deferred || discordInteraction.replied) {
				return;
			}
			try {
				await originalDeferReply();
			}
			catch (e) {
				CrowniclesLogger.errorWithObj("Failed to defer reply (interaction likely expired)", e);
			}
		};

		const interaction = discordInteraction as unknown as CrowniclesInteraction;
		interaction._channel = CrowniclesChannel.cast(discordInteraction.channel as GuildTextBasedChannel);
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

	public async reply(options: InteractionReplyOptions & {
		withResponse: true;
	}, fallback?: () => void | Promise<void>): Promise<InteractionCallbackResponse | null>;

	// Yes, we need to omit createMessageComponentCollector because the response is not a message and so the collectors are created on the interaction and not the message, and it mixes everything up
	public async reply(options: string | MessagePayload | InteractionReplyOptions & {
		withResponse?: false;
	}, fallback?: () => void | Promise<void>): Promise<Omit<InteractionResponse, "createMessageComponentCollector"> | null>;

	/**
	 * Send a reply to the user
	 * @param options classic discord.js send options
	 * @param fallback function to execute if the bot can't send the message
	 */
	public async reply<T extends string | MessagePayload | InteractionReplyOptions>(options: T, fallback?: () => void | Promise<void>): Promise<Omit<ReturnType<T>, "createMessageComponentCollector"> | null> {
		return await (CrowniclesInteraction.prototype.commonSendCommand<T>).call(
			this,
			(CommandInteraction.prototype.reply as ReplyFunctionLike<T>).bind(this),
			options,
			fallback ?? ((): void => {
				// Do nothing by default if no fallback is provided
			})
		);
	}

	/**
	 * Send a followUp to the user
	 * @param options classic discord.js send options
	 * @param fallback function to execute if the bot can't send the message
	 */
	public async followUp(options: string | InteractionReplyOptions | MessagePayload, fallback?: () => void | Promise<void>): Promise<Message | null> {
		return await (CrowniclesInteraction.prototype.commonSendCommand<string | MessagePayload | InteractionReplyOptions>).call(
			this,
			CommandInteraction.prototype.followUp.bind(this),
			options,
			fallback ?? ((): void => {
				// Do nothing by default if no fallback is provided
			})
		) as Message;
	}

	public async editReply(options: string | MessagePayload | InteractionEditReplyOptions, fallback?: () => void | Promise<void>): Promise<Message | null> {
		this._replyEdited = true;
		return await (CrowniclesInteraction.prototype.commonSendCommand<string | MessagePayload | InteractionEditReplyOptions>).call(
			this,
			CommandInteraction.prototype.editReply.bind(this),
			options,
			fallback ?? ((): void => {
				// Do nothing by default if no fallback is provided
			})
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
		fallback: () => void | Promise<void>
	): Promise<ReturnType<OptionType> | null> {
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
	public async send(options: string | MessageCreateOptions, fallback?: () => void | Promise<void>): Promise<Message | null> {
		try {
			return await BaseGuildTextChannel.prototype.send.bind(this)(options);
		}
		catch (e) {
			CrowniclesLogger.errorWithObj("Weird Permission Error", e);
			CrowniclesChannel.prototype.manageFallback.bind(this)();
			fallback ??= (): void => {
				// Do nothing by default if no fallback is provided
			};
			await fallback();
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
