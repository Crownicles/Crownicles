import {
	CommandTestListPacketReq, CommandTestListPacketRes, TestCommandArgument
} from "../../../../Lib/src/packets/commands/CommandTestListPacket";
import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { CommandsTest } from "../../core/CommandsTest";
import { adminCommand } from "../../core/utils/CommandUtils";

/**
 * Command to get the list of all available test commands for autocomplete
 */
export default class TestListCommand {
	@adminCommand(CommandTestListPacketReq, () => true)
	execute(response: CrowniclesPacket[], _packet: CommandTestListPacketReq): void {
		// Get all test commands from CommandsTest (remove duplicates: aliases point to the same command)
		const uniqueCommands = Object.values(CommandsTest.testCommandsArray)
			.filter((cmd, index, self) => index === self.findIndex(c => c.name === cmd.name));

		// Build a list of all command tokens (names + aliases) for the `help` command argument autocomplete
		const allCommandTokens = uniqueCommands
			.flatMap(cmd => [cmd.name, ...(cmd.aliases ?? [])])
			.filter((token, index, self) => self.indexOf(token) === index)
			.sort((a, b) => a.localeCompare(b));

		const commands = uniqueCommands.map(cmd => {
			// Extract argument info from typeWaited
			let args: TestCommandArgument[] | undefined;
			if (cmd.typeWaited) {
				args = Object.entries(cmd.typeWaited).map(([name, type]) => {
					const isHelpCommandArg = cmd.name === "help" && name === "command";
					return {
						name,
						type: type.toString(),
						suggestions: isHelpCommandArg ? allCommandTokens : cmd.argSuggestions?.[name]
					};
				});
			}

			return {
				name: cmd.name,
				aliases: cmd.aliases,
				category: cmd.category,
				commandFormat: cmd.commandFormat,
				args,
				// For `help`, provide direct full suggestions so Discord can filter before applying the 25-items limit
				fullSuggestions: cmd.name === "help" ? allCommandTokens : cmd.fullSuggestions
			};
		});

		response.push(makePacket(CommandTestListPacketRes, {
			commands
		}));
	}
}
