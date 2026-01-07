import { packetHandler } from "../../PacketHandler";
import { CommandTestListPacketRes, TestCommandArgument } from "../../../../../Lib/src/packets/commands/CommandTestListPacket";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { CrowniclesLogger } from "../../../../../Lib/src/logs/CrowniclesLogger";

/**
 * Test command metadata for autocomplete
 */
export interface TestCommandMetadata {
	name: string;
	aliases?: string[];
	category?: string;
	commandFormat?: string;
	args?: TestCommandArgument[];
	fullSuggestions?: string[]; // Complete argument combinations
}

/**
 * Cache for test commands list received from Core
 */
export class TestCommandsCache {
	private static commands: TestCommandMetadata[] = [];

	static setCommands(commands: TestCommandMetadata[]): void {
		this.commands = commands;
		CrowniclesLogger.info(`Loaded ${commands.length} test commands for autocomplete`);
	}

	static getCommands(): TestCommandMetadata[] {
		return this.commands;
	}

	static hasCommands(): boolean {
		return this.commands.length > 0;
	}

	/**
	 * Get a command by name (case-insensitive)
	 */
	static getCommand(name: string): TestCommandMetadata | undefined {
		const lowerName = name.toLowerCase();
		return this.commands.find(cmd =>
			cmd.name.toLowerCase() === lowerName ||
			cmd.aliases?.some(alias => alias.toLowerCase() === lowerName)
		);
	}
}

/**
 * Handle response with list of available test commands
 */
export default class CommandTestListPacketHandler {
	@packetHandler(CommandTestListPacketRes)
	async testListRes(_context: PacketContext, packet: CommandTestListPacketRes): Promise<void> {
		TestCommandsCache.setCommands(packet.commands);
		await Promise.resolve();
	}
}
