import {
	describe, expect, it
} from "vitest";
import {
	getCommandModuleImportPath, isCommandModuleFile
} from "../../src/commands/CommandDiscoveryUtils";

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

	it("uses the compiled command filename without adding another extension", () => {
		expect(getCommandModuleImportPath("admin", "DeleteCodeCommand.js"))
			.toBe("./admin/DeleteCodeCommand.js");
	});
});
