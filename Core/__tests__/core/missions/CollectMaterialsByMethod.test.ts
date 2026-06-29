import { describe, it, expect } from "vitest";
import {
	MATERIAL_COLLECT_METHOD, missionInterface
} from "../../../src/core/missions/interfaces/collectMaterialsByMethod";

describe("collectMaterialsByMethod mission", () => {
	describe("generateRandomVariant", () => {
		it("should always return a known collection method", () => {
			const validMethods = Object.values(MATERIAL_COLLECT_METHOD);
			for (let i = 0; i < 50; i++) {
				expect(validMethods).toContain(missionInterface.generateRandomVariant(0, null as never));
			}
		});
	});

	describe("areParamsMatchingVariantAndBlob", () => {
		it("should match when the collection method equals the variant", () => {
			expect(missionInterface.areParamsMatchingVariantAndBlob(MATERIAL_COLLECT_METHOD.BOSS, { method: MATERIAL_COLLECT_METHOD.BOSS }, null as unknown as Buffer)).toBe(true);
		});

		it("should not match when the collection method differs from the variant", () => {
			expect(missionInterface.areParamsMatchingVariantAndBlob(MATERIAL_COLLECT_METHOD.BOSS, { method: MATERIAL_COLLECT_METHOD.COMPOST }, null as unknown as Buffer)).toBe(false);
		});
	});
});
