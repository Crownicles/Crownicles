import { ICommand } from "../ICommand";
import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import {
	CommandTestPacketReq, CommandTestPacketRes
} from "../../../../Lib/src/packets/commands/CommandTestPacket";
import { SlashCommandBuilder } from "@discordjs/builders";
import { DiscordCache } from "../../bot/DiscordCache";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import {
	AttachmentBuilder,
	AutocompleteInteraction,
	GuildTextBasedChannel,
	HexColorString
} from "discord.js";
import { KeycloakUser } from "../../../../Lib/src/keycloak/KeycloakUser";
import { ColorConstants } from "../../../../Lib/src/constants/ColorConstants";
import { crowniclesClient } from "../../bot/CrowniclesShard";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";
import { TestCommandsCache } from "../../packetHandlers/handlers/commands/CommandTestListPacketHandler";
import {
	searchAutocomplete, toDiscordChoices
} from "../../utils/AutocompleteUtils";

/**
 * Generate combinations of arguments from lists of suggestions
 * @param argSuggestions Array of suggestion arrays for each argument
 * @param maxCombinations Maximum number of combinations to generate
 * @returns Array of combined argument strings
 */
function generateArgumentCombinations(argSuggestions: string[][], maxCombinations: number): string[] {
	if (argSuggestions.length === 0) {
		return [];
	}

	const combinations: string[] = [];

	// Calculate how many items to pick from each argument to stay within limit
	// We'll pick items in a round-robin fashion to get variety
	const totalPossible = argSuggestions.reduce((acc, arr) => acc * arr.length, 1);

	if (totalPossible <= maxCombinations) {
		// Generate all combinations if small enough
		const generateAll = (index: number, current: string[]): void => {
			if (index === argSuggestions.length) {
				combinations.push(current.join(" "));
				return;
			}
			for (const item of argSuggestions[index]) {
				generateAll(index + 1, [...current, item]);
			}
		};
		generateAll(0, []);
	}
	else {
		// Sample combinations to stay within limit
		// Pick first few from each combination level
		const itemsPerArg = Math.max(2, Math.floor(Math.pow(maxCombinations, 1 / argSuggestions.length)));
		const limitedSuggestions = argSuggestions.map(arr => arr.slice(0, itemsPerArg));

		const generateLimited = (index: number, current: string[]): void => {
			if (combinations.length >= maxCombinations) {
				return;
			}
			if (index === limitedSuggestions.length) {
				combinations.push(current.join(" "));
				return;
			}
			for (const item of limitedSuggestions[index]) {
				if (combinations.length >= maxCombinations) {
					break;
				}
				generateLimited(index + 1, [...current, item]);
			}
		};
		generateLimited(0, []);
	}

	return combinations;
}

/**
 * Get default suggestions for a given type
 */
function getDefaultSuggestionsForType(type: string): string[] {
	switch (type) {
		case "INTEGER":
			return ["1", "5", "10", "50", "100", "500", "1000"];
		case "ID":
			return []; // IDs should be provided by argSuggestions
		case "STRING":
		default:
			return [];
	}
}

/**
 * Generate dynamic suggestions based on user input and remaining arguments
 * @param currentInput The current user input
 * @param args The command arguments metadata
 * @returns Array of suggestion choices
 */
function generateDynamicSuggestions(
	currentInput: string,
	args: Array<{ name: string; type: string; suggestions?: string[] }>
): { name: string; value: string }[] {
	const choices: { name: string; value: string }[] = [];
	const inputParts = currentInput.trim().split(/\s+/).filter(s => s.length > 0);
	const isTypingNewArg = currentInput.endsWith(" ") || currentInput === "";

	// If user typed something, we need to complete remaining args
	const completedArgsCount = isTypingNewArg ? inputParts.length : Math.max(0, inputParts.length - 1);
	const currentTypingPart = isTypingNewArg ? "" : (inputParts[inputParts.length - 1] || "");
	const prefix = inputParts.slice(0, completedArgsCount).join(" ");
	const prefixWithSpace = prefix ? `${prefix} ` : "";

	// Get remaining arguments to complete
	const remainingArgs = args.slice(completedArgsCount);

	if (remainingArgs.length === 0) {
		// All args are complete, just return the current input
		if (currentInput.trim()) {
			choices.push({
				name: currentInput,
				value: currentInput
			});
		}
		return choices;
	}

	// Get suggestions for remaining arguments
	const remainingSuggestionsList = remainingArgs.map(arg =>
		arg.suggestions && arg.suggestions.length > 0
			? arg.suggestions
			: getDefaultSuggestionsForType(arg.type)
	);

	// If any remaining arg has no suggestions, we can't generate combinations
	const allHaveSuggestions = remainingSuggestionsList.every(s => s.length > 0);

	if (allHaveSuggestions) {
		// Generate combinations for remaining arguments
		const combinations = generateArgumentCombinations(remainingSuggestionsList, 25);

		for (const combo of combinations) {
			const fullValue = `${prefixWithSpace}${combo}`;
			// Filter based on what user is currently typing
			if (currentTypingPart === "" || combo.toLowerCase().startsWith(currentTypingPart.toLowerCase())) {
				choices.push({
					name: fullValue,
					value: fullValue
				});
				if (choices.length >= 25) {
					break;
				}
			}
		}
	}
	else {
		// Some args don't have suggestions, complete with what user typed + suggestions for next arg
		const nextArg = remainingArgs[0];
		const nextSuggestions = nextArg.suggestions && nextArg.suggestions.length > 0
			? nextArg.suggestions
			: getDefaultSuggestionsForType(nextArg.type);

		if (nextSuggestions.length > 0) {
			// If user is typing something, use it as first arg and suggest the rest
			if (currentTypingPart) {
				// User is typing a value, suggest completions with next args
				const nextArgsToComplete = args.slice(completedArgsCount + 1);
				const nextArgsSuggestions = nextArgsToComplete.map(arg =>
					arg.suggestions && arg.suggestions.length > 0
						? arg.suggestions
						: getDefaultSuggestionsForType(arg.type)
				);

				if (nextArgsSuggestions.length > 0 && nextArgsSuggestions.every(s => s.length > 0)) {
					const nextCombinations = generateArgumentCombinations(nextArgsSuggestions, 25);
					for (const combo of nextCombinations) {
						const fullValue = `${prefixWithSpace}${currentTypingPart} ${combo}`;
						choices.push({
							name: fullValue,
							value: fullValue
						});
						if (choices.length >= 25) {
							break;
						}
					}
				}
				else if (nextArgsToComplete.length === 0) {
					// Last arg, just complete with what user typed
					choices.push({
						name: `${prefixWithSpace}${currentTypingPart}`,
						value: `${prefixWithSpace}${currentTypingPart}`
					});
				}
			}
			else {
				// User hasn't typed anything for this arg, show default suggestions
				for (const suggestion of nextSuggestions.slice(0, 25)) {
					choices.push({
						name: `${prefixWithSpace}${suggestion}`,
						value: `${prefixWithSpace}${suggestion}`
					});
					if (choices.length >= 25) {
						break;
					}
				}
			}
		}
	}

	return choices;
}

async function getPacket(interaction: CrowniclesInteraction, user: KeycloakUser): Promise<CommandTestPacketReq> {
	const commandName = interaction.options.get("command");
	const args = interaction.options.get("arguments");
	await interaction.deferReply();
	return makePacket(CommandTestPacketReq, {
		keycloakId: user.id,
		command: commandName ? commandName.value as string : undefined,
		args: args ? args.value as string : undefined
	});
}

export async function handleCommandTestPacketRes(packet: CommandTestPacketRes, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);

	if (!interaction) {
		await sendResultWithoutInteraction(packet, context);
		return;
	}

	if (packet.isError) {
		const content = { content: packet.result };
		if (interaction.replied) {
			await interaction.channel.send(content);
		}
		else {
			await interaction.editReply(content);
		}
		return;
	}

	const embed = buildTestResultEmbed(packet.commandName, packet.result, interaction.user.displayAvatarURL());
	const payload = buildPayloadWithAttachments(embed, packet.fileName, packet.fileContentBase64);

	if (interaction.replied) {
		await interaction.channel.send(payload);
	}
	else {
		await interaction.editReply(payload);
	}
}

/**
 * Build test command result embed
 */
function buildTestResultEmbed(commandName: string, result: string, userAvatarUrl?: string): CrowniclesEmbed {
	return new CrowniclesEmbed()
		.setAuthor({
			name: `Commande test ${commandName} exécutée :`,
			iconURL: userAvatarUrl
		})
		.setDescription(result)
		.setColor(<HexColorString> ColorConstants.SUCCESSFUL);
}

/**
 * Build payload with optional file attachments
 */
function buildPayloadWithAttachments(embed: CrowniclesEmbed, fileName?: string, fileContentBase64?: string): {
	embeds: CrowniclesEmbed[];
	files?: AttachmentBuilder[];
} {
	const attachments = fileName && fileContentBase64
		? [new AttachmentBuilder(Buffer.from(fileContentBase64, "base64")).setName(fileName)]
		: [];

	return attachments.length > 0
		? {
			embeds: [embed],
			files: attachments
		}
		: { embeds: [embed] };
}

async function sendResultWithoutInteraction(packet: CommandTestPacketRes, context: PacketContext): Promise<void> {
	const channelId = context.discord?.channel;
	if (!channelId) {
		CrowniclesLogger.warn("Command test result without context channel");
		return;
	}

	if (!crowniclesClient?.isReady()) {
		CrowniclesLogger.warn("Discord client not ready to deliver command test result");
		return;
	}

	const channel = await crowniclesClient.channels.fetch(channelId).catch(e => {
		CrowniclesLogger.errorWithObj("Unable to fetch channel for test command result", e);
		return null;
	});

	if (!channel || !channel.isTextBased()) {
		CrowniclesLogger.warn(`Channel ${channelId} unavailable for test command result`);
		return;
	}

	const textChannel = channel as GuildTextBasedChannel;

	if (packet.isError) {
		await textChannel.send({ content: packet.result }).catch((e: unknown) => {
			CrowniclesLogger.errorWithObj("Failed to deliver test command error result", e);
		});
		return;
	}

	const userId = context.discord?.user;
	const user = userId
		? await crowniclesClient.users.fetch(userId).catch(() => null)
		: null;

	const embed = buildTestResultEmbed(packet.commandName, packet.result, user?.displayAvatarURL());
	const payload = buildPayloadWithAttachments(embed, packet.fileName, packet.fileContentBase64);

	await textChannel.send(payload).catch((e: unknown) => {
		CrowniclesLogger.errorWithObj("Failed to deliver test command result in fallback", e);
	});
}

async function handleAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
	try {
		const focusedOption = interaction.options.getFocused(true);

		// Check if we have test commands cached
		if (!TestCommandsCache.hasCommands()) {
			CrowniclesLogger.warn("Test commands not yet loaded for autocomplete");
			await interaction.respond([]);
			return;
		}

		// Handle autocomplete for the command option
		if (focusedOption.name === "command") {
			const testCommands = TestCommandsCache.getCommands().map(cmd => ({
				key: cmd.name,
				displayName: cmd.name,
				aliases: cmd.aliases && cmd.aliases.length > 0 ? cmd.aliases : [cmd.name]
			}));

			const results = searchAutocomplete(testCommands, focusedOption.value);
			const choices = toDiscordChoices(results);

			await interaction.respond(choices);
			return;
		}

		// Handle autocomplete for the arguments option
		if (focusedOption.name === "arguments") {
			const commandName = interaction.options.getString("command");
			if (!commandName) {
				await interaction.respond([]);
				return;
			}

			const command = TestCommandsCache.getCommand(commandName);
			if (!command) {
				await interaction.respond([]);
				return;
			}

			const currentInput = focusedOption.value || "";
			let choices: { name: string; value: string }[] = [];

			// Priority 1: Use fullSuggestions if available (complete argument combinations)
			if (command.fullSuggestions && command.fullSuggestions.length > 0) {
				const lowerInput = currentInput.toLowerCase();

				for (const suggestion of command.fullSuggestions) {
					if (suggestion.toLowerCase().startsWith(lowerInput) || currentInput === "") {
						choices.push({
							name: suggestion,
							value: suggestion
						});
						if (choices.length >= 25) {
							break;
						}
					}
				}

				// If user is typing something not in suggestions, try dynamic suggestions
				if (choices.length === 0 && currentInput.trim() && command.args) {
					choices = generateDynamicSuggestions(currentInput, command.args);
				}
			}
			// Priority 2: Use dynamic suggestion generation based on args metadata
			else if (command.args && command.args.length > 0) {
				choices = generateDynamicSuggestions(currentInput, command.args);
			}

			// If we have choices, respond with them
			if (choices.length > 0) {
				await interaction.respond(choices.slice(0, 25));
				return;
			}

			// Fallback: Always provide useful options
			const fallbackChoices: { name: string; value: string }[] = [];

			// If user typed something, allow them to use it
			if (currentInput.trim()) {
				fallbackChoices.push({
					name: currentInput,
					value: currentInput
				});
			}

			// Show format hint if available
			if (command.commandFormat) {
				fallbackChoices.push({
					name: `Format: ${command.commandFormat}`,
					value: currentInput || ""
				});
			}

			await interaction.respond(fallbackChoices.slice(0, 25));
			return;
		}

		await interaction.respond([]);
	}
	catch (error) {
		CrowniclesLogger.errorWithObj("Error while handling test autocomplete", error);

		// Respond with empty array to prevent Discord errors
		try {
			await interaction.respond([]);
		}
		catch {
			// Ignore errors from respond fallback
		}
	}
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("test")
		.addStringOption(option => SlashCommandBuilderGenerator.generateOption("test", "commandName", option)
			.setRequired(false)
			.setAutocomplete(true))
		.addStringOption(option => SlashCommandBuilderGenerator.generateOption("test", "args", option)
			.setRequired(false)
			.setAutocomplete(true)) as SlashCommandBuilder,
	getPacket,
	mainGuildCommand: false,
	handleAutocomplete
};
