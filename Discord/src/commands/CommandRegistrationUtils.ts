import {
	InteractionContextType, RESTPostAPIChatInputApplicationCommandsJSONBody
} from "discord-api-types/v10";
import { ICommand } from "./ICommand";

/**
 * Get the Discord contexts in which a command can be invoked.
 * `ICommand.allowedInDM` is the single source of truth: commands are guild-only unless they opt into DMs.
 * @param commandInfo
 */
export function getCommandContexts(commandInfo: ICommand): InteractionContextType[] {
	return commandInfo.allowedInDM
		? [InteractionContextType.Guild, InteractionContextType.BotDM]
		: [InteractionContextType.Guild];
}

/**
 * Build the payload sent to Discord to register a command
 * @param commandInfo
 */
export function buildCommandRegistrationBody(commandInfo: ICommand): RESTPostAPIChatInputApplicationCommandsJSONBody {
	return {
		...commandInfo.slashCommandBuilder.toJSON(),
		contexts: getCommandContexts(commandInfo)
	};
}
