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
 * Represents raw command line arguments
 */
class CommandArguments {
	constructor(public readonly args: string[]) {}

	get length(): number {
		return this.args.length;
	}

	get firstArg(): string | undefined {
		return this.args[0];
	}

	isNamedFormat(): boolean {
		return this.length > 0 && this.firstArg?.startsWith("--") === true;
	}
}

/**
 * Represents parsed argument with its metadata
 */
class ParsedArgument {
	constructor(
		public readonly name: string,
		public readonly value: string | undefined,
		public readonly skipNext: boolean
	) {}

	static fromNamedArg(arg: string, nextArg: string | undefined): ParsedArgument {
		const equalIndex = arg.indexOf("=");

		if (equalIndex !== -1) {
			// Format: --name=value
			return new ParsedArgument(
				arg.substring(2, equalIndex),
				arg.substring(equalIndex + 1),
				false
			);
		}

		// Format: --name value (value is next arg)
		return new ParsedArgument(
			arg.substring(2),
			nextArg,
			nextArg !== undefined
		);
	}
}

/**
 * Represents the schema of expected arguments for a command
 */
class ArgumentSchema {
	public readonly argNames: string[];

	constructor(public readonly typeWaited: { [argName: string]: TypeKey }) {
		this.argNames = Object.keys(typeWaited);
	}

	get length(): number {
		return this.argNames.length;
	}

	findArgIndex(name: string): number {
		return this.argNames.indexOf(name);
	}

	getTypeAt(index: number): TypeKey {
		return this.typeWaited[this.argNames[index]];
	}

	getArgNameAt(index: number): string {
		return this.argNames[index];
	}
}

/**
 * Result of argument parsing
 */
class ParsedArguments {
	constructor(
		public readonly values: string[],
		public readonly usedNamedArgs: boolean
	) {}

	get length(): number {
		return this.values.length;
	}
}

/**
 * Process named arguments and populate the parsed array
 */
function processNamedArguments(
	cmdArgs: CommandArguments,
	schema: ArgumentSchema
): string[] {
	const parsedArgs: string[] = new Array(schema.length).fill(undefined);

	for (let i = 0; i < cmdArgs.length; i++) {
		const arg = cmdArgs.args[i];
		const nextArg = i + 1 < cmdArgs.length ? cmdArgs.args[i + 1] : undefined;
		const parsed = ParsedArgument.fromNamedArg(arg, nextArg);
		const argIndex = schema.findArgIndex(parsed.name);

		if (argIndex !== -1 && parsed.value !== undefined) {
			parsedArgs[argIndex] = parsed.value;
		}

		if (parsed.skipNext) {
			i++; // Skip next arg as it's the value
		}
	}

	return parsedArgs;
}

/**
 * Parse arguments supporting both positional and named formats
 * Named format: --argName=value or --argName value
 */
export function parseTestCommandArgs(
	args: string[],
	typeWaited: { [argName: string]: TypeKey }
): ParsedArguments {
	const cmdArgs = new CommandArguments(args);
	const schema = new ArgumentSchema(typeWaited);
	let parsedValues: string[];

	if (cmdArgs.isNamedFormat()) {
		parsedValues = processNamedArguments(cmdArgs, schema);
	}
	else {
		// Positional arguments
		parsedValues = new Array(schema.length).fill(undefined);
		for (let i = 0; i < cmdArgs.length && i < parsedValues.length; i++) {
			parsedValues[i] = cmdArgs.args[i];
		}
	}

	return new ParsedArguments(
		parsedValues.filter(arg => arg !== undefined),
		cmdArgs.isNamedFormat()
	);
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
		const parsedResult = parseTestCommandArgs(args, commandTest.typeWaited);

		if (parsedResult.length < minArgsRequired || parsedResult.length > nbArgsWaited) {
			const formattedFormat = formatCommandFormat(commandTest.commandFormat);
			return {
				good: false,
				description: `❌ Mauvais nombre d'arguments pour la commande test ${commandTest.name}\n\n**Format attendu :** \`test ${commandTest.name} ${formattedFormat}\`\n\n**Astuce :** Vous pouvez utiliser des arguments nommés : \`--argName=value\` ou \`--argName value\``
			};
		}

		for (let i = 0; i < parsedResult.length; i++) {
			if (commandTest.typeWaited[commandTypeKeys[i]] !== CommandsTest.getTypeOf(parsedResult.values[i])) {
				const formattedFormat = formatCommandFormat(commandTest.commandFormat);
				return {
					good: false,
					description: `❌ Mauvais argument pour la commande test ${commandTest.name}

**Format attendu** : \`test ${commandTest.name} ${formattedFormat}\`
**Format de l'argument** \`<${commandTypeKeys[i]}>\` : ${formatTypeWaited(commandTest.typeWaited[commandTypeKeys[i]])}
**Format reçu** : ${formatTypeWaited(CommandsTest.getTypeOf(parsedResult.values[i]))}

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
