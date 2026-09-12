import {describe, expect, it, vi} from "vitest";
import PetCommand from "../../../src/commands/pet/PetCommand";
import {CrowniclesPacket} from "../../../../Lib/src/packets/CrowniclesPacket";
import {CommandPetPowersPacketRes} from "../../../../Lib/src/packets/commands/CommandPetPacket";
import {PetConstants} from "../../../../Lib/src/constants/PetConstants";
import {PetDataController} from "../../../src/data/Pet";

vi.mock("../../../src/core/utils/CommandUtils", () => ({commandRequires: () => (_target: unknown, _name: string, descriptor: PropertyDescriptor) => descriptor, CommandUtils: {WHERE: {EVERYWHERE: []}, DISALLOWED_EFFECTS: {NOT_STARTED_OR_DEAD: []}}}));

describe("pet power catalog", () => {
	it("publishes each combat species once without private pet statistics", () => {
		const response: CrowniclesPacket[] = [];
		new PetCommand().powers(response);
		const packet = response.find((value): value is CommandPetPowersPacketRes => value instanceof CommandPetPowersPacketRes);
		expect(packet).toBeDefined();
		const powers = packet!.powers;
		expect(new Set(powers.map(power => power.petTypeId)).size).toBe(powers.length);
		expect(powers.length).toBeGreaterThan(0);
		for (const power of powers) {
			expect(PetConstants.PET_BEHAVIORS.find(behavior => behavior.petIds.includes(power.petTypeId))?.behaviorId).toBe(power.assistanceId);
			expect(power.rarity).toBe(PetDataController.instance.getById(power.petTypeId)?.rarity);
			expect(Object.keys(power).sort()).toEqual(["assistanceId", "petTypeId", "rarity"]);
		}
	});
});