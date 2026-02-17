import { describe, expect, it } from "vitest";
import { missionInterface } from "../../../src/core/missions/interfaces/depositPetInShelter";

describe("depositPetInShelter mission", () => {
	it("should always generate variant 0", () => {
		expect(missionInterface.generateRandomVariant()).toBe(0);
	});

	describe("areParamsMatchingVariantAndBlob", () => {
		it("should always return true", () => {
			const result = missionInterface.areParamsMatchingVariantAndBlob(0, {}, null as unknown as Buffer);
			expect(result).toBe(true);
		});
	});

	describe("initialNumberDone", () => {
		it("should return 0 when player has a pet", () => {
			const result = missionInterface.initialNumberDone({ petId: 42 } as never);
			expect(result).toBe(0);
		});

		it("should return 1 when player has no pet", () => {
			const result = missionInterface.initialNumberDone({ petId: null } as never);
			expect(result).toBe(1);
		});
	});

	describe("updateSaveBlob", () => {
		it("should always return null", () => {
			const result = missionInterface.updateSaveBlob(0, Buffer.from("1,2"), {});
			expect(result).toBeNull();
		});
	});
});
