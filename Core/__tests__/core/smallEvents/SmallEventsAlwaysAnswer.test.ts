import {
	afterEach, beforeEach, describe, expect, it, vi
} from "vitest";
import { smallEventFuncs as talvarFuncs } from "../../../src/core/smallEvents/dwarfPetFan";
import { smallEventFuncs as petDropTokenFuncs } from "../../../src/core/smallEvents/petDropToken";
import { smallEventFuncs as winGuildXPFuncs } from "../../../src/core/smallEvents/winGuildXP";
import { MissionsController } from "../../../src/core/missions/MissionsController";
import { PetEntities } from "../../../src/core/database/game/models/PetEntity";
import { DwarfPetsSeen } from "../../../src/core/database/game/models/DwarfPetsSeen";
import { PetExpedition } from "../../../src/core/database/game/models/PetExpedition";
import { Guilds } from "../../../src/core/database/game/models/Guild";
import { MapLinkDataController } from "../../../src/data/MapLink";
import { CrowniclesPacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { SmallEventDwarfPetFanPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventDwarfPetFanPacket";
import { SmallEventDoNothingPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventDoNothingPacket";
import { SmallEventConstants } from "../../../../Lib/src/constants/SmallEventConstants";

const player = {
	id: 1,
	keycloakId: "keycloak",
	petId: null,
	guildId: null,
	mapLinkId: 1
} as never;

async function execute(executeSmallEvent: typeof talvarFuncs.executeSmallEvent): Promise<CrowniclesPacket[]> {
	const response: CrowniclesPacket[] = [];
	await executeSmallEvent(player, { response } as never);
	return response;
}

describe("small events answer the player even when their preconditions no longer hold", () => {
	beforeEach(() => {
		vi.spyOn(MissionsController, "update").mockResolvedValue(undefined as never);
		vi.spyOn(PetEntities, "getById").mockResolvedValue(null);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("Talvar answers with the no pet interaction when the player has no pet", async () => {
		vi.spyOn(DwarfPetsSeen, "isAllPetSeen").mockResolvedValue(false);

		const packet = (await execute(talvarFuncs.executeSmallEvent)).find(p => p instanceof SmallEventDwarfPetFanPacket) as SmallEventDwarfPetFanPacket | undefined;
		expect(packet?.interactionName).toBe(SmallEventConstants.DWARF_PET_FAN.INTERACTIONS_NAMES.NO_PET);
	});

	it("the pet drop token event does nothing when no pet is on an expedition on the path anymore", async () => {
		vi.spyOn(MapLinkDataController.instance, "getById").mockReturnValue({
			startMap: 1, endMap: 2
		} as never);
		vi.spyOn(PetExpedition, "findAll").mockResolvedValue([]);

		expect((await execute(petDropTokenFuncs.executeSmallEvent)).some(p => p instanceof SmallEventDoNothingPacket)).toBe(true);
	});

	it("the guild experience event does nothing when the player has no guild", async () => {
		vi.spyOn(Guilds, "getById").mockResolvedValue(null);

		expect((await execute(winGuildXPFuncs.executeSmallEvent)).some(p => p instanceof SmallEventDoNothingPacket)).toBe(true);
	});
});
