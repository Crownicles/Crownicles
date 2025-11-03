import { describe, it, expect } from "vitest";
import { missionInterface } from "../../../src/core/missions/interfaces/exploreDifferentPlaces";

describe("exploreDifferentPlaces mission", () => {
	describe("areParamsMatchingVariantAndBlob", () => {
		it("should return true when saveBlob is null (first place)", () => {
			const result = missionInterface.areParamsMatchingVariantAndBlob(0, { placeId: 26 }, null as unknown as Buffer);
			expect(result).toBe(true);
		});

		it("should return true when placeId is not in saveBlob (new place)", () => {
			const saveBlob = Buffer.from("1,2");
			const result = missionInterface.areParamsMatchingVariantAndBlob(0, { placeId: 26 }, saveBlob);
			expect(result).toBe(true);
		});

		it("should return false when placeId is already in saveBlob (already visited)", () => {
			const saveBlob = Buffer.from("1,26,2");
			const result = missionInterface.areParamsMatchingVariantAndBlob(0, { placeId: 26 }, saveBlob);
			expect(result).toBe(false);
		});

		it("should return false when revisiting the first place", () => {
			const saveBlob = Buffer.from("26,1,2");
			const result = missionInterface.areParamsMatchingVariantAndBlob(0, { placeId: 26 }, saveBlob);
			expect(result).toBe(false);
		});

		it("should return false when revisiting the last place", () => {
			const saveBlob = Buffer.from("1,2,26");
			const result = missionInterface.areParamsMatchingVariantAndBlob(0, { placeId: 26 }, saveBlob);
			expect(result).toBe(false);
		});
	});

	describe("updateSaveBlob", () => {
		it("should create a new blob with the placeId when saveBlob is null", () => {
			const result = missionInterface.updateSaveBlob(0, null as unknown as Buffer, { placeId: 26 });
			expect(result.toString()).toBe("26");
		});

		it("should append the placeId to existing saveBlob", () => {
			const saveBlob = Buffer.from("1,2");
			const result = missionInterface.updateSaveBlob(0, saveBlob, { placeId: 26 });
			expect(result.toString()).toBe("1,2,26");
		});

		it("should handle the scenario from bug report: Mergagnan -> Sentinelle -> Mergagnan", () => {
			// Starting at Voie champêtre (2)
			let saveBlob = missionInterface.updateSaveBlob(0, null as unknown as Buffer, { placeId: 2 });
			expect(saveBlob.toString()).toBe("2");
			expect(missionInterface.areParamsMatchingVariantAndBlob(0, { placeId: 2 }, saveBlob)).toBe(false);

			// Arriving at Mergagnan (26) - first time
			expect(missionInterface.areParamsMatchingVariantAndBlob(0, { placeId: 26 }, saveBlob)).toBe(true);
			saveBlob = missionInterface.updateSaveBlob(0, saveBlob, { placeId: 26 });
			expect(saveBlob.toString()).toBe("2,26");

			// Arriving at Sentinelle (1)
			expect(missionInterface.areParamsMatchingVariantAndBlob(0, { placeId: 1 }, saveBlob)).toBe(true);
			saveBlob = missionInterface.updateSaveBlob(0, saveBlob, { placeId: 1 });
			expect(saveBlob.toString()).toBe("2,26,1");

			// Returning to Mergagnan (26) - should NOT count as new place
			expect(missionInterface.areParamsMatchingVariantAndBlob(0, { placeId: 26 }, saveBlob)).toBe(false);
			// With the fix, updateBlob should NOT be called when areParamsMatchingVariantAndBlob returns false
			// So the blob should remain "2,26,1" and NOT become "2,26,1,26"
		});
	});
});
