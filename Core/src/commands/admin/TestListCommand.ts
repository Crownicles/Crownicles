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
		// Get all test commands from CommandsTest
		const commands = Object.values(CommandsTest.testCommandsArray)
			.filter((cmd, index, self) =>

				// Remove duplicates (aliases point to same command)
				index === self.findIndex(c => c.name === cmd.name))
			.map(cmd => {
				// Extract argument info from typeWaited
				let args: TestCommandArgument[] | undefined;
				if (cmd.typeWaited) {
					args = Object.entries(cmd.typeWaited).map(([name, type]) => ({
						name,
						type: type.toString(),
						suggestions: cmd.argSuggestions?.[name]
					}));
				}

				return {
					name: cmd.name,
					aliases: cmd.aliases,
					category: cmd.category,
					commandFormat: cmd.commandFormat,
					args,
					fullSuggestions: cmd.fullSuggestions
				};
			});

		response.push(makePacket(CommandTestListPacketRes, {
			commands
		}));
	}
}
