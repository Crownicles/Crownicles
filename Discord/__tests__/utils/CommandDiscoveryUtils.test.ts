import {
	describe, expect, it
} from "vitest";
import { isCommandModuleFile } from "../../src/commands/CommandDiscoveryUtils";

describe("isCommandModuleFile", () => {
	it("accepts compiled command modules", () => {
		expect(isCommandModuleFile("MissionShopCommand.js")).toBe(true);
	});

	it("rejects JavaScript helper modules", () => {
		expect(isCommandModuleFile("MissionShopUtils.js")).toBe(false);
	});

	it("rejects source maps", () => {
		expect(isCommandModuleFile("MissionShopCommand.js.map")).toBe(false);
	});
});