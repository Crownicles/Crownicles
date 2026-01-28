import { botConfig } from "../../index";
import {
	CommandTestPacketReq, CommandTestPacketRes
} from "../../../../Lib/src/packets/commands/CommandTestPacket";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandsTest, ITestCommand, parseTestCommandArgs
} from "../../core/CommandsTest";
import { Player } from "../../core/database/game/models/Player";
import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";

/**
 * Execute a single test command
 */
async function executeSingleTestCommand(params: {
	testCommand: string;
	argsTest: string[];
	player: Player;
	response: CrowniclesPacket[];
	context: PacketContext;
}): Promise<void> {
	const {
		testCommand, argsTest, player, response, context
	} = params;

	let commandTestCurrent: ITestCommand;
	try {
		commandTestCurrent = CommandsTest.getTestCommand(testCommand);
	}
	catch (e) {
		const error = e as Error;
		response.push(makePacket(CommandTestPacketRes, {
			commandName: testCommand,
			result: `:x: | Commande test ${testCommand} inexistante : \`\`\`${error.stack}\`\`\``,
			isError: true
		}));
		return;
	}

	// Check if the test command has the good arguments
	const testGoodFormat = CommandsTest.isGoodFormat(commandTestCurrent, argsTest);
	if (!testGoodFormat.good) {
		response.push(makePacket(CommandTestPacketRes, {
			commandName: testCommand,
			result: testGoodFormat.description,
			isError: true
		}));
		return;
	}

	// Execute the test command
	try {
		// Parse arguments to support named arguments
		const parsedArgs = commandTestCurrent.typeWaited
			? parseTestCommandArgs(argsTest, commandTestCurrent.typeWaited).values
			: argsTest;

		const messageToDisplay = await commandTestCurrent.execute!(player, parsedArgs, response, context);

		// Only send response if there's a message to display
		if (messageToDisplay) {
			response.push(makePacket(CommandTestPacketRes, {
				commandName: testCommand,
				result: messageToDisplay,
				isError: false
			}));
		}
	}
	catch (e) {
		const error = e as Error;
		CrowniclesLogger.errorWithObj(`Error while executing test command ${testCommand}`, error);
		response.push(makePacket(CommandTestPacketRes, {
			commandName: testCommand,
			result: `:x: | Une erreur est survenue pendant la commande test ${testCommand} : \`\`\`${error.stack}\`\`\``,
			isError: true
		}));
	}
}

/**
 * Parse test command string and extract arguments
 */
function parseTestCommand(testCommand: string): {
	command: string; args: string[];
} {
	let args: string[];
	try {
		args = testCommand.split(" ")
			.slice(1);
	}
	catch {
		args = [];
	}

	const command = testCommand.split(" ")[0];

	return {
		command, args
	};
}

export default class TestCommand {
	// Don't use adminCommand there because we need all the checks for the player
	@commandRequires(CommandTestPacketReq, {
		notBlocked: false,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE
	})
	async execute(response: CrowniclesPacket[], player: Player, packet: CommandTestPacketReq, context: PacketContext): Promise<void> {
		if (!botConfig.TEST_MODE) {
			return;
		}

		let testCommands: string[];
		try {
			testCommands = packet.command?.split(" && ") ?? ["list"];
		}
		catch {
			testCommands = ["list"];
		}

		for (const testCommandStr of testCommands) {
			const {
				command, args
			} = parseTestCommand(testCommandStr);
			await executeSingleTestCommand({
				testCommand: command,
				argsTest: args,
				player,
				response,
				context
			});
		}
	}
}
