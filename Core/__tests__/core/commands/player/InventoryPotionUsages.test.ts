import {
	describe, expect, it, vi
} from "vitest";
import { buildPotionDisplayPacket } from "../../../../src/commands/player/InventoryPotionUtils";
import { NO_STAT_COMPARISON } from "../../../../../Lib/src/types/StatValues";

vi.mock("../../../../src/core/utils/CommandUtils", () => ({
	commandRequires: () => (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) => descriptor,
	CommandUtils: {
		DISALLOWED_EFFECTS: { NOT_STARTED_OR_DEAD: [] },
		WHERE: { EVERYWHERE: [] }
	}
}));

describe("inventory potion usages", () => {
	it("forwards the remaining usages to the potion display packet", () => {
		const getDisplayPacket = vi.fn().mockReturnValue({ usages: 2, maxUsages: 5 });
		const potionSlot = {
			getItem: () => ({ getDisplayPacket }),
			remainingPotionUsages: 2
		};

		const result = buildPotionDisplayPacket(potionSlot as never);

		expect(getDisplayPacket).toHaveBeenCalledWith(NO_STAT_COMPARISON, 2);
		expect(result).toEqual({ usages: 2, maxUsages: 5 });
	});
});