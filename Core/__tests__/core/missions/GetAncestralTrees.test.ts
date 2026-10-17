import {
	describe, it, expect, vi, beforeEach
} from "vitest";
import { missionInterface } from "../../../src/core/missions/interfaces/getAncestralTrees";
import { PlantId } from "../../../../Lib/src/constants/PlantConstants";
import { Homes } from "../../../src/core/database/game/models/Home";
import { PlayerPlantSlots } from "../../../src/core/database/game/models/PlayerPlantSlot";
import { HomePlantStorages } from "../../../src/core/database/game/models/HomePlantStorage";

const player = { id: 1 } as never;

describe("getAncestralTrees mission", () => {
	it("should always generate variant 0", () => {
		expect(missionInterface.generateRandomVariant(0 as never, player)).toBe(0);
	});

	it("should always match variant and blob", () => {
		expect(missionInterface.areParamsMatchingVariantAndBlob(0, {}, null)).toBe(true);
	});

	it("should always return null save blob", () => {
		expect(missionInterface.updateSaveBlob(0, null, {})).toBeNull();
	});

	describe("initialNumberDone", () => {
		beforeEach(() => {
			vi.restoreAllMocks();
			vi.spyOn(PlayerPlantSlots, "hasPlantInPlantSlots").mockResolvedValue(false);
			vi.spyOn(Homes, "getOfPlayer").mockResolvedValue({ id: 10 } as never);
			vi.spyOn(HomePlantStorages, "getForPlant").mockResolvedValue(null);
		});

		it("should validate when an ancestral tree plant is in the player's plant inventory", async () => {
			vi.spyOn(PlayerPlantSlots, "hasPlantInPlantSlots").mockResolvedValue(true);
			expect(await missionInterface.initialNumberDone(player, 0)).toBe(1);
		});

		it("should validate when an ancestral tree plant is stored in the home chest", async () => {
			vi.spyOn(HomePlantStorages, "getForPlant").mockResolvedValue({ quantity: 1 } as never);
			expect(await missionInterface.initialNumberDone(player, 0)).toBe(1);
		});

		it("should not validate when no ancestral tree plant is held", async () => {
			expect(await missionInterface.initialNumberDone(player, 0)).toBe(0);
		});

		it("should not validate when the player has no home and no inventory plant", async () => {
			vi.spyOn(Homes, "getOfPlayer").mockResolvedValue(null);
			expect(await missionInterface.initialNumberDone(player, 0)).toBe(0);
		});

		it("should not validate when the stored quantity is zero", async () => {
			vi.spyOn(HomePlantStorages, "getForPlant").mockResolvedValue({ quantity: 0 } as never);
			expect(await missionInterface.initialNumberDone(player, 0)).toBe(0);
		});

		it("should query the ancestral tree plant id", async () => {
			const spy = vi.spyOn(PlayerPlantSlots, "hasPlantInPlantSlots").mockResolvedValue(true);
			await missionInterface.initialNumberDone(player, 0);
			expect(spy).toHaveBeenCalledWith(player.id, PlantId.ANCIENT_TREE);
		});
	});
});
