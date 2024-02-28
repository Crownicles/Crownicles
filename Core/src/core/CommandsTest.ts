import {readdir} from "fs/promises";
import {readdirSync} from "fs";
import {isAnId, isAnEmoji} from "../../../Lib/src/utils/StringUtils";
import {DraftBotPacket, makePacket} from "../../../Lib/src/packets/DraftBotPacket";
import Player, {Players} from "./database/game/models/Player";
import {Client} from "../../../Lib/src/instances/Client";
import {CommandTestPacketRes} from "../../../Lib/src/packets/commands/CommandTestPacket";

type Checker = (v: string) => boolean;

export enum TypeKey {
	INTEGER = "INTEGER",
	ID = "ID",
	EMOJI = "EMOJI",
	STRING = "STRING"
}

const typeVariableChecks: Map<TypeKey, Checker> = new Map<TypeKey, Checker>([
	[TypeKey.INTEGER, (v: string): boolean => !isNaN(parseInt(v, 10))],
	[TypeKey.ID, (v: string): boolean => isAnId(v)],
	[TypeKey.EMOJI, (v: string): boolean => isAnEmoji(v)],
	[TypeKey.STRING, (): boolean => false]
]);

export interface ITestCommand {
	name: string,
	aliases?: string[],
	commandFormat?: string,
	typeWaited?: { [argName: string]: TypeKey }
	description: string,
	execute?: ExecuteTestCommandLike,
	category?: string
}

export type ExecuteTestCommandLike = (player: Player, args: string[], response: DraftBotPacket[], client: Client) => string | Promise<string>;

/**
 * @class
 */
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
	 * @param {string[]} args - The args given to the test
	 * @return {boolean, string} - {true, ""} if the args are good, {false, "error message"} if not
	 */
	static isGoodFormat(
		commandTest: ITestCommand,
		args: string[]
	): { good: boolean, description: string } {
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
		if (nbArgsWaited !== args.length) {
			return {
				good: false,
				description: `❌ Mauvais nombre d'arguments pour la commande test ${commandTest.name}\n\n**Format attendu :** \`test ${commandTest.name} ${commandTest.commandFormat}\``
			};
		}
		for (let i = 0; i < nbArgsWaited; i++) {
			if (commandTest.typeWaited[commandTypeKeys[i]] !== CommandsTest.getTypeOf(args[i])) {
				return {
					good: false,
					description: `❌ Mauvais argument pour la commande test ${commandTest.name}

**Format attendu** : \`test ${commandTest.name} ${commandTest.commandFormat}\`
**Format de l'argument** \`<${commandTypeKeys[i]}>\` : ${commandTest.typeWaited[commandTypeKeys[i]]}
**Format reçu** : ${CommandsTest.getTypeOf(args[i])}`
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
	 * @private
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
