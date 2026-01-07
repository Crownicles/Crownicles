import { describe, expect, it } from "vitest";
import {
	CrowniclesPacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { CommandsTest, TypeKey } from "../../../src/core/CommandsTest";
import TestListCommand from "../../../src/commands/admin/TestListCommand";

function setTestCommandsArray(commands: Array<{ name: string; aliases?: string[]; typeWaited?: Record<string, TypeKey> }>): void {
	const map: Record<string, any> = {};
	for (const cmd of commands) {
		map[cmd.name.toLowerCase()] = cmd;
		for (const alias of cmd.aliases ?? []) {
			map[alias.toLowerCase()] = cmd;
		}
	}
	CommandsTest.testCommandsArray = map;
}

describe("TestListCommand autocomplete metadata", () => {
	it("should provide help argument suggestions for command names", () => {
		setTestCommandsArray([
			{ name: "help", aliases: ["h"], typeWaited: { command: TypeKey.STRING } },
			{ name: "talisman", aliases: ["tal"], typeWaited: { type: TypeKey.STRING, action: TypeKey.STRING } },
			{ name: "aitournament", aliases: ["ai"], typeWaited: { round: TypeKey.INTEGER } }
		]);

		const response: CrowniclesPacket[] = [];
		new TestListCommand().execute(response, {} as any);

		expect(response).toHaveLength(1);
		const packet: any = response[0];
		expect(packet.commands).toBeTruthy();

		const helpCmd = packet.commands.find((c: any) => c.name === "help");
		expect(helpCmd).toBeTruthy();

		// Full suggestions should contain other command names/aliases
		expect(helpCmd.fullSuggestions).toContain("talisman");
		expect(helpCmd.fullSuggestions).toContain("tal");
		expect(helpCmd.fullSuggestions).toContain("aitournament");
		expect(helpCmd.fullSuggestions).toContain("ai");

		// Args metadata should also expose suggestions for the "command" argument
		const arg = helpCmd.args.find((a: any) => a.name === "command");
		expect(arg).toBeTruthy();
		expect(arg.suggestions).toContain("talisman");
	});
});
