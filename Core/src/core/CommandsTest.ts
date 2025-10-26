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

/**
 * Represents a file path for command loading
 */
class CommandFilePath {
	constructor(
		private readonly type: string,
		private readonly fileName: string
	) {}

	getRequirePath(): string {
		const fileNameWithoutExtension = this.fileName.substring(0, this.fileName.length - 3);
		return `../commands/admin/testCommands/${this.type}/${fileNameWithoutExtension}`;
	}

	static fromFileName(type: string, fileName: string): CommandFilePath {
		return new CommandFilePath(type, fileName);
	}
}

/**
 * Represents a directory path for command scanning
 */
class CommandDirectoryPath {
	constructor(private readonly basePath: string) {}

	getPath(type: string): string {
		return `${this.basePath}/${type}`;
	}

	static fromDistPath(): CommandDirectoryPath {
		return new CommandDirectoryPath("dist/Core/src/commands/admin/testCommands");
	}
}

/**
 * Represents an argument name in a command schema
 */
class ArgumentName {
	constructor(public readonly value: string) {}

	equals(other: ArgumentName | string): boolean {
		const otherValue = typeof other === "string" ? other : other.value;
		return this.value === otherValue;
	}
}

/**
 * Represents an argument value with type validation
 */
class ArgumentValue {
	constructor(public readonly value: string) {}

	getType(): TypeKey {
		for (const typeIn of typeVariableChecks.keys()) {
			if (typeVariableChecks.get(typeIn)(this.value)) {
				return typeIn;
			}
		}
		return TypeKey.STRING;
	}

	matchesType(expectedType: TypeKey): boolean {
		return this.getType() === expectedType;
	}
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
 * Represents a command name with validation
 */
class CommandName {
	constructor(public readonly value: string) {}

	toLowerCase(): string {
		return this.value.toLowerCase();
	}

	equals(other: CommandName | string): boolean {
		const otherValue = typeof other === "string" ? other : other.value;
		return this.toLowerCase() === otherValue.toLowerCase();
	}
}

/**
 * Represents a command category
 */
class CommandCategory {
	constructor(public readonly value: string) {}

	equals(other: CommandCategory | string): boolean {
		const otherValue = typeof other === "string" ? other : other.value;
		return this.value === otherValue;
	}
}

/**
 * Represents a formatted command format string
 */
class FormattedCommandFormat {
	constructor(public readonly value: string) {}

	static fromRaw(commandFormat: string | undefined): FormattedCommandFormat {
		if (!commandFormat) {
			return new FormattedCommandFormat("");
		}

		// Replace [param] with *[param]* to make optional params italic in markdown
		const formatted = commandFormat.replace(/\[([^\]]+)\]/g, "*[$1]*");
		return new FormattedCommandFormat(formatted);
	}

	toString(): string {
		return this.value;
	}
}

/**
 * Represents validation result for command arguments
 */
class ValidationResult {
	constructor(
		public readonly isValid: boolean,
		public readonly errorMessage: string
	) {}

	static success(): ValidationResult {
		return new ValidationResult(true, "");
	}

	static failure(message: string): ValidationResult {
		return new ValidationResult(false, message);
	}

	toObject(): {
		good: boolean;
		description: string;
	} {
		return {
			good: this.isValid,
			description: this.errorMessage
		};
	}
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
	return FormattedCommandFormat.fromRaw(commandFormat).toString();
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
		const dirPath = CommandDirectoryPath.fromDistPath();
		CommandsTest.testCommType = await readdir("dist/Core/src/commands/admin/testCommands");
		for (const type of CommandsTest.testCommType) {
			const commandsFiles = readdirSync(dirPath.getPath(type)).filter((command: string) => command.endsWith(".js"));
			for (const commandFile of commandsFiles) {
				const filePath = CommandFilePath.fromFileName(type, commandFile);
				this.initCommandTestFromCommandFile(filePath, type);
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
		if (!commandTest.typeWaited) {
			return args.length === 0
				? ValidationResult.success().toObject()
				: ValidationResult.failure(`❌ Mauvais format pour la commande test ${commandTest.name}\n\n**Format attendu :** \`test ${commandTest.name}\``).toObject();
		}

		const commandName = new CommandName(commandTest.name);
		const commandTypeKeys = Object.keys(commandTest.typeWaited);
		const nbArgsWaited = commandTypeKeys.length;
		const minArgsRequired = commandTest.minArgs ?? nbArgsWaited;

		// Parse arguments (supports both positional and named formats)
		const parsedResult = parseTestCommandArgs(args, commandTest.typeWaited);

		if (parsedResult.length < minArgsRequired || parsedResult.length > nbArgsWaited) {
			const formattedFormat = FormattedCommandFormat.fromRaw(commandTest.commandFormat);
			return ValidationResult.failure(
				`❌ Mauvais nombre d'arguments pour la commande test ${commandName.value}\n\n**Format attendu :** \`test ${commandName.value} ${formattedFormat}\`\n\n**Astuce :** Vous pouvez utiliser des arguments nommés : \`--argName=value\` ou \`--argName value\``
			).toObject();
		}

		for (let i = 0; i < parsedResult.length; i++) {
			const argValue = new ArgumentValue(parsedResult.values[i]);
			const expectedType = commandTest.typeWaited[commandTypeKeys[i]];

			if (!argValue.matchesType(expectedType)) {
				const formattedFormat = FormattedCommandFormat.fromRaw(commandTest.commandFormat);
				const argName = new ArgumentName(commandTypeKeys[i]);
				const errorMessage = `❌ Mauvais argument pour la commande test ${commandName.value}

**Format attendu** : \`test ${commandName.value} ${formattedFormat}\`
**Format de l'argument** \`<${argName.value}>\` : ${formatTypeWaited(expectedType)}
**Format reçu** : ${formatTypeWaited(argValue.getType())}

**Astuce :** Vous pouvez utiliser des arguments nommés : \`--${argName.value}=value\``;
				return ValidationResult.failure(errorMessage).toObject();
			}
		}
		return ValidationResult.success().toObject();
	}

	static getTestCommand(commandName: string): ITestCommand {
		const name = new CommandName(commandName);
		const commandTestCurrent = CommandsTest.testCommandsArray[name.toLowerCase()];
		if (!commandTestCurrent) {
			throw new Error(`Commande Test non définie : ${name.value}`);
		}
		return commandTestCurrent;
	}

	static getAllCommandsFromCategory(category: string): ITestCommand[] {
		const searchCategory = new CommandCategory(category);
		const tabCommandReturn: ITestCommand[] = [];
		for (const testCommand of Object.values(CommandsTest.testCommandsArray)) {
			if (testCommand.category && searchCategory.equals(testCommand.category)) {
				tabCommandReturn.push(testCommand);
			}
		}

		// Remove duplicates
		return tabCommandReturn.filter((elem, pos) => tabCommandReturn.indexOf(elem) === pos);
	}

	/**
	 * Initialize a test command from its file
	 * @param filePath - Path to the command file
	 * @param type - Command category type
	 */
	private static initCommandTestFromCommandFile(filePath: CommandFilePath, type: string): void {
		const category = new CommandCategory(type);
		const testCommand: ITestCommand = require(filePath.getRequirePath()).commandInfo;
		testCommand.category = category.value;
		const commandName = new CommandName(testCommand.name);
		CommandsTest.testCommandsArray[commandName.toLowerCase()] = testCommand;
		if (testCommand.aliases) {
			for (const alias of testCommand.aliases) {
				const aliasName = new CommandName(alias);
				this.testCommandsArray[aliasName.toLowerCase()] = testCommand;
			}
		}
	}
}
