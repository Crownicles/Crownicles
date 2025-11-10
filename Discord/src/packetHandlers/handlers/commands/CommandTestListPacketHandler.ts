import { packetHandler } from "../../PacketHandler";
import { CommandTestListPacketRes } from "../../../../../Lib/src/packets/commands/CommandTestListPacket";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { CrowniclesLogger } from "../../../../../Lib/src/logs/CrowniclesLogger";

/**
 * Cache for test commands list received from Core
 */
export class TestCommandsCache {
	private static commands: Array<{
		name: string;
		aliases?: string[];
		category?: string;
	}> = [];

	static setCommands(commands: typeof TestCommandsCache.commands): void {
		this.commands = commands;
		CrowniclesLogger.info(`Loaded ${commands.length} test commands for autocomplete`);
	}

	static getCommands(): typeof TestCommandsCache.commands {
		return this.commands;
	}

	static hasCommands(): boolean {
		return this.commands.length > 0;
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
