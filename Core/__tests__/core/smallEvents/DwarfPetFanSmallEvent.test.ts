import {
	afterEach, beforeEach, describe, expect, it, vi
} from "vitest";
import { smallEventFuncs as talvarFuncs } from "../../../src/core/smallEvents/dwarfPetFan";
import { MissionsController } from "../../../src/core/missions/MissionsController";
import { PetEntities } from "../../../src/core/database/game/models/PetEntity";
import { DwarfPetsSeen } from "../../../src/core/database/game/models/DwarfPetsSeen";
import { CrowniclesPacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { SmallEventDwarfPetFanPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventDwarfPetFanPacket";
import { SmallEventConstants } from "../../../../Lib/src/constants/SmallEventConstants";

const playerWithoutPet = {
	id: 1,
	keycloakId: "keycloak",
	petId: null
} as never;

describe("Talvar small event", () => {
	beforeEach(() => {
		vi.spyOn(MissionsController, "update").mockResolvedValue(undefined as never);
		vi.spyOn(PetEntities, "getById").mockResolvedValue(null);
		vi.spyOn(DwarfPetsSeen, "isAllPetSeen").mockResolvedValue(false);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("answers with the no pet interaction when the player has no pet", async () => {
		const response: CrowniclesPacket[] = [];
		await talvarFuncs.executeSmallEvent(playerWithoutPet, { response } as never);

		const packet = response.find(p => p instanceof SmallEventDwarfPetFanPacket) as SmallEventDwarfPetFanPacket | undefined;
		expect(packet?.interactionName).toBe(SmallEventConstants.DWARF_PET_FAN.INTERACTIONS_NAMES.NO_PET);
	});
});
