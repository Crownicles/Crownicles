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
 * Represents a file name for command files
 */
class CommandFileName {
	constructor(public readonly value: string) {}

	/**
	 * Get the filename without extension
	 */
	withoutExtension(): string {
		return this.value.substring(0, this.value.length - 3);
	}

	/**
	 * Check if this is a JavaScript file
	 */
	isJavaScriptFile(): boolean {
		return this.value.endsWith(".js");
	}
}

/**
 * Represents a type/category name for commands
 */
class CommandTypeName {
	constructor(public readonly value: string) {}

	/**
	 * Convert to string representation
	 */
	toString(): string {
		return this.value;
	}
}

/**
 * Represents a file path for command loading
 */
class CommandFilePath {
	constructor(
		private readonly type: CommandTypeName,
		private readonly fileName: CommandFileName
	) {}

	/**
	 * Get the require path for the command file
	 */
	getRequirePath(): string {
		return `../commands/admin/testCommands/${this.type.value}/${this.fileName.withoutExtension()}`;
	}

	/**
	 * Load the command info from the file
	 */
	loadCommandInfo(): ITestCommand {
		// Dynamic import is required here as commands are loaded at runtime
		return require(this.getRequirePath()).commandInfo as ITestCommand;
	}

	/**
	 * Create a CommandFilePath from type and filename
	 */
	static fromFileName(type: CommandTypeName, fileName: CommandFileName): CommandFilePath {
		return new CommandFilePath(type, fileName);
	}
}

/**
 * Represents a directory path for command scanning
 */
class CommandDirectoryPath {
	constructor(private readonly basePath: string) {}

	/**
	 * Get the full path for a command type
	 */
	getPath(type: string): string {
		return `${this.basePath}/${type}`;
	}

	/**
	 * Create a CommandDirectoryPath for the distribution folder
	 */
	static fromDistPath(): CommandDirectoryPath {
		return new CommandDirectoryPath("dist/Core/src/commands/admin/testCommands");
	}
}

/**
 * Represents an argument name in a command schema
 */
class ArgumentName {
	constructor(public readonly value: string) {}

	/**
	 * Check equality with another ArgumentName or string
	 */
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

	/**
	 * Get the type of this argument value
	 */
	getType(): TypeKey {
		for (const typeIn of typeVariableChecks.keys()) {
			if (typeVariableChecks.get(typeIn)(this.value)) {
				return typeIn;
			}
		}
		return TypeKey.STRING;
	}

	/**
	 * Check if this value matches the expected type
	 */
	matchesType(expectedType: TypeKey): boolean {
		return this.getType() === expectedType;
	}
}

/**
 * Represents an autocomplete suggestion
 */
export interface IAutocompleteSuggestion {
	name: string;
	value: string;
}

/**
 * Function type for getting autocomplete suggestions
 */
export type GetAutocompleteSuggestionsLike = (argIndex: number, partialValue: string) => Promise<IAutocompleteSuggestion[]>;

export interface ITestCommand {
	name: string;
	aliases?: string[];
	commandFormat?: string;
	typeWaited?: { [argName: string]: TypeKey };
	minArgs?: number; // Minimum number of arguments required (for optional params)
	description: string;
	execute?: ExecuteTestCommandLike;
	category?: string;
	getAutocompleteSuggestions?: GetAutocompleteSuggestionsLike;
	argSuggestions?: { [argName: string]: string[] }; // Static suggestions for each argument
	fullSuggestions?: string[]; // Complete argument combinations (e.g., "5 m", "8 f")
}

/**
 * Represents a command name with validation
 */
class CommandName {
	constructor(public readonly value: string) {}

	/**
	 * Convert to lowercase
	 */
	toLowerCase(): string {
		return this.value.toLowerCase();
	}

	/**
	 * Check equality with another CommandName or string (case-insensitive)
	 */
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

	/**
	 * Check equality with another CommandCategory or string
	 */
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

	/**
	 * Create a FormattedCommandFormat from raw string
	 */
	static fromRaw(commandFormat: string | undefined): FormattedCommandFormat {
		if (!commandFormat) {
			return new FormattedCommandFormat("");
		}

		// Replace [param] with *[param]* to make optional params italic in markdown
		const formatted = commandFormat.replace(/\[([^\]]+)\]/g, "*[$1]*");
		return new FormattedCommandFormat(formatted);
	}

	/**
	 * Convert to string representation
	 */
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

	/**
	 * Create a successful validation result
	 */
	static success(): ValidationResult {
		return new ValidationResult(true, "");
	}

	/**
	 * Create a failed validation result
	 */
	static failure(message: ErrorMessage): ValidationResult {
		return new ValidationResult(false, message.toString());
	}

	/**
	 * Convert to object format expected by command system
	 */
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
 * Represents argument type validation context
 */
class ArgumentTypeValidationContext {
	constructor(
		public readonly commandName: CommandName,
		public readonly format: FormattedCommandFormat,
		public readonly argName: ArgumentName,
		public readonly expectedType: TypeKey,
		public readonly receivedType: TypeKey
	) {}

	/**
	 * Create error message for this validation context
	 */
	toErrorMessage(): string {
		return `❌ Mauvais argument pour la commande test ${this.commandName.value}

**Format attendu** : \`test ${this.commandName.value} ${this.format}\`
**Format de l'argument** \`<${this.argName.value}>\` : ${formatTypeWaited(this.expectedType)}
**Format reçu** : ${formatTypeWaited(this.receivedType)}

**Astuce :** Vous pouvez utiliser des arguments nommés : \`--${this.argName.value}=value\``;
	}
}

/**
 * Represents an error message with formatting
 */
class ErrorMessage {
	constructor(private readonly message: string) {}

	toString(): string {
		return this.message;
	}

	static invalidCommandFormat(cmdName: CommandName): ErrorMessage {
		return new ErrorMessage(`❌ Mauvais format pour la commande test ${cmdName.value}\n\n**Format attendu :** \`test ${cmdName.value}\``);
	}

	static invalidArgumentCount(cmdName: CommandName, format: FormattedCommandFormat): ErrorMessage {
		return new ErrorMessage(`❌ Mauvais nombre d'arguments pour la commande test ${cmdName.value}\n\n**Format attendu :** \`test ${cmdName.value} ${format}\`\n\n**Astuce :** Vous pouvez utiliser des arguments nommés : \`--argName=value\` ou \`--argName value\``);
	}

	static invalidArgumentType(context: ArgumentTypeValidationContext): ErrorMessage {
		return new ErrorMessage(context.toErrorMessage());
	}
}

/**
 * Represents raw command line arguments
 */
class CommandArguments {
	constructor(public readonly args: string[]) {}

	/**
	 * Get the number of arguments
	 */
	get length(): number {
		return this.args.length;
	}

	/**
	 * Get the first argument
	 */
	get firstArg(): string | undefined {
		return this.args[0];
	}

	/**
	 * Check if arguments use named format (--name=value)
	 */
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

	/**
	 * Parse a named argument from command line
	 */
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

	/**
	 * Get the number of expected arguments
	 */
	get length(): number {
		return this.argNames.length;
	}

	/**
	 * Find the index of an argument by name
	 */
	findArgIndex(name: string): number {
		return this.argNames.indexOf(name);
	}

	/**
	 * Get the expected type at a given index
	 */
	getTypeAt(index: number): TypeKey {
		return this.typeWaited[this.argNames[index]];
	}

	/**
	 * Get the argument name at a given index
	 */
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
			const typeName = new CommandTypeName(type);
			const commandsFiles = readdirSync(dirPath.getPath(type))
				.filter((command: string) => new CommandFileName(command).isJavaScriptFile());
			for (const commandFile of commandsFiles) {
				const fileName = new CommandFileName(commandFile);
				const filePath = CommandFilePath.fromFileName(typeName, fileName);
				this.initCommandTestFromCommandFile(filePath, typeName);
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
			const commandName = new CommandName(commandTest.name);
			return args.length === 0
				? ValidationResult.success().toObject()
				: ValidationResult.failure(ErrorMessage.invalidCommandFormat(commandName)).toObject();
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
				ErrorMessage.invalidArgumentCount(commandName, formattedFormat)
			).toObject();
		}

		for (let i = 0; i < parsedResult.length; i++) {
			const argValue = new ArgumentValue(parsedResult.values[i]);
			const expectedType = commandTest.typeWaited[commandTypeKeys[i]];

			if (!argValue.matchesType(expectedType)) {
				const formattedFormat = FormattedCommandFormat.fromRaw(commandTest.commandFormat);
				const argName = new ArgumentName(commandTypeKeys[i]);
				const validationContext = new ArgumentTypeValidationContext(
					commandName,
					formattedFormat,
					argName,
					expectedType,
					argValue.getType()
				);
				const errorMsg = ErrorMessage.invalidArgumentType(validationContext);
				return ValidationResult.failure(errorMsg).toObject();
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

	/**
	 * Get autocomplete suggestions for a test command's arguments
	 * @param commandName - The name of the test command
	 * @param argIndex - The index of the argument being typed (0-based)
	 * @param partialValue - The partial value the user has typed so far
	 * @returns Array of suggestions
	 */
	static async getAutocompleteSuggestions(commandName: string, argIndex: number, partialValue: string): Promise<IAutocompleteSuggestion[]> {
		try {
			const command = CommandsTest.getTestCommand(commandName);

			// If the command has a custom autocomplete handler, use it
			if (command.getAutocompleteSuggestions) {
				return await command.getAutocompleteSuggestions(argIndex, partialValue);
			}

			// Default: if command has typeWaited, return type hints
			if (command.typeWaited) {
				const argNames = Object.keys(command.typeWaited);
				if (argIndex < argNames.length) {
					const argName = argNames[argIndex];
					const argType = command.typeWaited[argName];
					return [{
						name: `<${argName}> (${argType})`,
						value: partialValue || ""
					}];
				}
			}

			return [];
		}
		catch {
			return [];
		}
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
	 * @param typeName - Command category type
	 */
	private static initCommandTestFromCommandFile(filePath: CommandFilePath, typeName: CommandTypeName): void {
		const category = new CommandCategory(typeName.value);
		const testCommand = filePath.loadCommandInfo();
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
