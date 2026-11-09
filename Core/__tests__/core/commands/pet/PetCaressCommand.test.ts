import {beforeEach, describe, expect, it, vi} from "vitest";
import PetCaressCommand from "../../../../src/commands/pet/PetCaressCommand";
import {Player} from "../../../../src/core/database/game/models/Player";
import {MissionsController} from "../../../../src/core/missions/MissionsController";
import {CrowniclesPacket, makePacket} from "../../../../../Lib/src/packets/CrowniclesPacket";
import {CommandPetCaressPacketReq, CommandPetCaressPacketRes} from "../../../../../Lib/src/packets/commands/CommandPetPacket";

vi.mock("../../../../src/core/database/game/models/Player", () => ({Player: class {}}));
vi.mock("../../../../src/core/utils/CommandUtils", () => ({
	commandRequires: () => (_target: unknown, _name: string, descriptor: PropertyDescriptor) => descriptor,
	CommandUtils: {DISALLOWED_EFFECTS: {NOT_STARTED_OR_DEAD: []}, WHERE: {EVERYWHERE: []}}
}));
vi.mock("../../../../src/core/missions/MissionsController", () => ({MissionsController: {update: vi.fn()}}));

describe("pet caress acknowledgement", () => {
	beforeEach(() => vi.clearAllMocks());

	it("acknowledges only after mission processing completes", async () => {
		let complete = (): void => undefined;
		vi.mocked(MissionsController.update).mockReturnValueOnce(new Promise(resolve => {complete = resolve;}));
		const response: CrowniclesPacket[] = [];
		const execution = new PetCaressCommand().execute(response, {} as Player, makePacket(CommandPetCaressPacketReq, {}));
		expect(response).toEqual([]);
		complete();
		await execution;
		expect(response).toHaveLength(1);
		expect(response[0]).toBeInstanceOf(CommandPetCaressPacketRes);
	});

	it("does not report success after a mission processing failure", async () => {
		vi.mocked(MissionsController.update).mockRejectedValueOnce(new Error("database unavailable"));
		const response: CrowniclesPacket[] = [];
		await expect(new PetCaressCommand().execute(response, {} as Player, makePacket(CommandPetCaressPacketReq, {}))).rejects.toThrow("database unavailable");
		expect(response).toEqual([]);
	});
});