import { readdir } from "fs/promises";
import { readdirSync } from "fs";
import { isAnId } from "../../../Lib/src/utils/StringUtils";
import {
	CrowniclesPacket, PacketContext
} from "../../../Lib/src/packets/CrowniclesPacket";
import Player from "./database/game/models/Player";

type Checker = (v: string) => boolean;

export enum TypeKey {
	INTEGER = "INTEGER",
	ID = "ID",
	STRING = "STRING"
}

const typeVariableChecks: Map<TypeKey, Checker> = new Map<TypeKey, Checker>([
	[TypeKey.ID, (v: string): boolean => isAnId(v)],
	[TypeKey.INTEGER, (v: string): boolean => !isNaN(parseInt(v, 10))],
	[TypeKey.STRING, (): boolean => false]
]);

const typeVariableFormatLike: Map<TypeKey, string> = new Map<TypeKey, string>([
	[TypeKey.ID, "0a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c (voir `/test command:myids`)"],
	[TypeKey.INTEGER, "###"],
	[TypeKey.STRING, "texte"]
]);

/**
 * Format the type waited for the command
 * @param typeWaited
 */
export function formatTypeWaited(typeWaited: TypeKey): string {
	return `\`${typeWaited}\`(${typeVariableFormatLike.get(typeWaited)})`;
}

export interface ITestCommand {
	name: string;
	aliases?: string[];
	commandFormat?: string;
	typeWaited?: { [argName: string]: TypeKey };
	minArgs?: number; // Minimum number of arguments required (for optional params)
	description: string;
	execute?: ExecuteTestCommandLike;
	category?: string;
}

/**
 * Parse arguments supporting both positional and named formats
 * Named format: --argName=value or --argName value
 * @param args - Raw arguments
 * @param typeWaited - Expected argument types
 * @returns Parsed arguments in order
 */
export function parseTestCommandArgs(
	args: string[],
	typeWaited: { [argName: string]: TypeKey }
): {
	parsedArgs: string[];
	usedNamedArgs: boolean;
} {
	const argNames = Object.keys(typeWaited);
	const parsedArgs: string[] = new Array(argNames.length).fill(undefined);
	let usedNamedArgs = false;

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];

		// Check if it's a named argument (--name=value or --name value)
		if (arg.startsWith("--")) {
			usedNamedArgs = true;
			const equalIndex = arg.indexOf("=");

			if (equalIndex !== -1) {
				// Format: --name=value
				const name = arg.substring(2, equalIndex);
				const value = arg.substring(equalIndex + 1);
				const argIndex = argNames.indexOf(name);

				if (argIndex !== -1) {
					parsedArgs[argIndex] = value;
				}
			}
			else {
				// Format: --name value (value is next arg)
				const name = arg.substring(2);
				const argIndex = argNames.indexOf(name);

				if (argIndex !== -1 && i + 1 < args.length) {
					parsedArgs[argIndex] = args[i + 1];
					i++; // Skip next arg as it's the value
				}
			}
		}
		else if (!usedNamedArgs) {
			// Positional argument (only if we haven't started using named args)
			parsedArgs[i] = arg;
		}
	}

	// Filter out undefined values
	return {
		parsedArgs: parsedArgs.filter(arg => arg !== undefined),
		usedNamedArgs
	};
}

/**
 * Format command format string with markdown for optional parameters
 * @param commandFormat - Raw command format
 * @returns Formatted string with italics for optional params
 */
export function formatCommandFormat(commandFormat: string): string {
	if (!commandFormat) {
		return "";
	}

	// Replace [param] with *[param]* to make optional params italic in markdown
	return commandFormat.replace(/\[([^\]]+)\]/g, "*[$1]*");
}

export type ExecuteTestCommandLike = (player: Player, args: string[], response: CrowniclesPacket[], context: PacketContext) => string | Promise<string>;

export class CommandsTest {
	static testCommandsArray: { [commandName: string]: ITestCommand };

	static testCommType: string[];

	/**
	 * Load all the test commands from source files
	 */
	static async init(): Promise<void> {
		CommandsTest.testCommandsArray = {};
		CommandsTest.testCommType = await readdir("dist/Core/src/commands/admin/testCommands");
		for (const type of CommandsTest.testCommType) {
			const commandsFiles = readdirSync(`dist/Core/src/commands/admin/testCommands/${type}`).filter((command: string) => command.endsWith(".js"));
			for (const commandFile of commandsFiles) {
				this.initCommandTestFromCommandFile(type, commandFile);
			}
		}
	}

	/**
	 * Say if the given args are the args awaited for the given command
	 * @param commandTest - The command to test
	 * @param args - The args given to the test
	 * @returns - {true, ""} if the args are good, {false, "error message"} if not
	 */
	static isGoodFormat(
		commandTest: ITestCommand,
		args: string[]
	): {
		good: boolean; description: string;
	} {
		const ret = {
			good: true,
			description: ""
		};
		if (!commandTest.typeWaited) {
			ret.good = args.length === 0;
			ret.description = ret.good ? "" : `❌ Mauvais format pour la commande test ${commandTest.name}\n\n**Format attendu :** \`test ${commandTest.name}\``;
			return ret;
		}

		const commandTypeKeys = Object.keys(commandTest.typeWaited);
		const nbArgsWaited = commandTypeKeys.length;
		const minArgsRequired = commandTest.minArgs ?? nbArgsWaited;

		// Parse arguments (supports both positional and named formats)
		const { parsedArgs } = parseTestCommandArgs(args, commandTest.typeWaited);

		if (parsedArgs.length < minArgsRequired || parsedArgs.length > nbArgsWaited) {
			const formattedFormat = formatCommandFormat(commandTest.commandFormat);
			return {
				good: false,
				description: `❌ Mauvais nombre d'arguments pour la commande test ${commandTest.name}\n\n**Format attendu :** \`test ${commandTest.name} ${formattedFormat}\`\n\n**Astuce :** Vous pouvez utiliser des arguments nommés : \`--argName=value\` ou \`--argName value\``
			};
		}

		for (let i = 0; i < parsedArgs.length; i++) {
			if (commandTest.typeWaited[commandTypeKeys[i]] !== CommandsTest.getTypeOf(parsedArgs[i])) {
				const formattedFormat = formatCommandFormat(commandTest.commandFormat);
				return {
					good: false,
					description: `❌ Mauvais argument pour la commande test ${commandTest.name}

**Format attendu** : \`test ${commandTest.name} ${formattedFormat}\`
**Format de l'argument** \`<${commandTypeKeys[i]}>\` : ${formatTypeWaited(commandTest.typeWaited[commandTypeKeys[i]])}
**Format reçu** : ${formatTypeWaited(CommandsTest.getTypeOf(parsedArgs[i]))}

**Astuce :** Vous pouvez utiliser des arguments nommés : \`--${commandTypeKeys[i]}=value\``
				};
			}
		}
		return ret;
	}

	static getTypeOf(variable: string): TypeKey {
		for (const typeIn of typeVariableChecks.keys()) {
			if (typeVariableChecks.get(typeIn)(variable)) {
				return typeIn;
			}
		}
		return TypeKey.STRING;
	}

	static getTestCommand(commandName: string): ITestCommand {
		const commandTestCurrent = CommandsTest.testCommandsArray[commandName.toLowerCase()];
		if (!commandTestCurrent) {
			throw new Error(`Commande Test non définie : ${commandName}`);
		}
		return commandTestCurrent;
	}

	static getAllCommandsFromCategory(category: string): ITestCommand[] {
		const tabCommandReturn: ITestCommand[] = [];
		for (const testCommand of Object.values(CommandsTest.testCommandsArray)) {
			if (testCommand.category === category) {
				tabCommandReturn.push(testCommand);
			}
		}

		// Remove duplicates
		return tabCommandReturn.filter((elem, pos) => tabCommandReturn.indexOf(elem) === pos);
	}

	/**
	 * Initialize a test command from its file
	 * @param type
	 * @param commandFile
	 */
	private static initCommandTestFromCommandFile(type: string, commandFile: string): void {
		const testCommand: ITestCommand = require(`../commands/admin/testCommands/${type}/${commandFile.substring(0, commandFile.length - 3)}`).commandInfo;
		testCommand.category = type;
		CommandsTest.testCommandsArray[testCommand.name.toLowerCase()] = testCommand;
		if (testCommand.aliases) {
			for (const alias of testCommand.aliases) {
				this.testCommandsArray[alias.toLowerCase()] = testCommand;
			}
		}
	}
}
