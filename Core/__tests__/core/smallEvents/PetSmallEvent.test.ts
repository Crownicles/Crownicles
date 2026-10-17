import {
	afterEach, describe, expect, it, vi
} from "vitest";
import type { PacketContext } from "../../../../Lib/src/packets/CrowniclesPacket";
import { PetConstants } from "../../../../Lib/src/constants/PetConstants";
import { smallEventFuncs } from "../../../src/core/smallEvents/pet";
import Player from "../../../src/core/database/game/models/Player";
import {
	PetEntities, PetEntity
} from "../../../src/core/database/game/models/PetEntity";
import { PetDataController } from "../../../src/data/Pet";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { InventorySlots } from "../../../src/core/database/game/models/InventorySlot";
import { LogsDatabase } from "../../../src/core/database/logs/LogsDatabase";
import { MissionsController } from "../../../src/core/missions/MissionsController";

describe("pet small event", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("clears the player pet through the locked mission mutation when it flees", async () => {
		const player = {
			id: 1,
			keycloakId: "pet-flee-player",
			petId: 12
		} as Player;
		const petEntity = {
			id: 12,
			typeId: 1,
			sex: "m",
			nickname: "",
			isFeisty: vi.fn().mockReturnValue(true),
			destroy: vi.fn().mockResolvedValue(undefined)
		} as unknown as PetEntity;
		vi.spyOn(PetEntities, "getById").mockResolvedValue(petEntity);
		vi.spyOn(PetDataController.instance, "getById").mockReturnValue({} as never);
		vi.spyOn(PetEntities, "generateRandomPetEntityNotGuild").mockReturnValue({
			typeId: 2,
			sex: "f"
		} as PetEntity);
		vi.spyOn(RandomUtils, "randInt").mockReturnValue(16);
		vi.spyOn(InventorySlots, "getPlayerActiveObjects").mockResolvedValue({} as never);
		vi.spyOn(LogsDatabase, "logPetFree").mockResolvedValue(undefined);
		vi.spyOn(MissionsController, "update").mockImplementation(async (inputPlayer, _response, mission) => {
			mission.applyOnLockedPlayer?.(inputPlayer);
			return inputPlayer;
		});
		const response = [];

		await smallEventFuncs.executeSmallEvent(response, player, {} as PacketContext);

		expect(petEntity.destroy).toHaveBeenCalledOnce();
		expect(player.petId).toBeNull();
		expect(MissionsController.update).toHaveBeenCalledWith(player, response, expect.objectContaining({
			missionId: "depositPetInShelter",
			applyOnLockedPlayer: expect.any(Function)
		}));
		expect(response[0]).toMatchObject({ interactionName: PetConstants.PET_INTERACTIONS_NAMES.PET_FLEE });
	});
});
