import {afterEach, describe, expect, it, vi} from "vitest";
import UpdateCommand from "../../../src/commands/player/UpdateCommand";
import {CrowniclesPacket} from "../../../../Lib/src/packets/CrowniclesPacket";
import {version} from "../../../package.json";

vi.mock("../../../src/core/utils/CommandUtils", () => ({commandRequires: () => (_target: unknown, _name: string, descriptor: PropertyDescriptor) => descriptor, CommandUtils: {WHERE: {EVERYWHERE: []}}}));

describe("module version", () => {
	afterEach(() => vi.unstubAllEnvs());
	it("returns the packaged version when Core is started directly with Node", () => {
		vi.stubEnv("npm_package_version", undefined);
		const response: CrowniclesPacket[] = [];
		new UpdateCommand().execute(response);
		expect(response).toEqual([expect.objectContaining({coreVersion: version})]);
	});
});
