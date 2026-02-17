import { describe, expect, it } from "vitest";
import { missionInterface } from "../../../src/core/missions/interfaces/winAnyBossWithDifferentClasses";

describe("winAnyBossWithDifferentClasses mission", () => {
	it("should always generate variant 0", () => {
		expect(missionInterface.generateRandomVariant()).toBe(0);
	});

	it("should start with 0 done", () => {
		expect(missionInterface.initialNumberDone()).toBe(0);
	});

	describe("areParamsMatchingVariantAndBlob", () => {
		it("should return true when saveBlob is null", () => {
			const result = missionInterface.areParamsMatchingVariantAndBlob(0, { classId: 3 }, null as unknown as Buffer);
			expect(result).toBe(true);
		});

		it("should return true when classId is not already in saveBlob", () => {
			const saveBlob = Buffer.from("1,2");
			const result = missionInterface.areParamsMatchingVariantAndBlob(0, { classId: 3 }, saveBlob);
			expect(result).toBe(true);
		});

		it("should return false when classId is already in saveBlob", () => {
			const saveBlob = Buffer.from("1,2,3");
			const result = missionInterface.areParamsMatchingVariantAndBlob(0, { classId: 3 }, saveBlob);
			expect(result).toBe(false);
		});

		it("should not confuse class identifiers with shared digits", () => {
			const saveBlob = Buffer.from("11,12");
			const result = missionInterface.areParamsMatchingVariantAndBlob(0, { classId: 1 }, saveBlob);
			expect(result).toBe(true);
		});
	});

	describe("updateSaveBlob", () => {
		it("should create saveBlob with classId when saveBlob is null", () => {
			const result = missionInterface.updateSaveBlob(0, null as unknown as Buffer, { classId: 4 });
			expect(result.toString()).toBe("4");
		});

		it("should append classId to existing saveBlob", () => {
			const saveBlob = Buffer.from("1,2");
			const result = missionInterface.updateSaveBlob(0, saveBlob, { classId: 4 });
			expect(result.toString()).toBe("1,2,4");
		});
	});
});
