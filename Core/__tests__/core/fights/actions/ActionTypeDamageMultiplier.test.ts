import {
	afterEach, describe, expect, it, vi
} from "vitest";
import {
	FightAction, FightActionDataController
} from "../../../../src/data/FightAction";
import { FightActionType } from "../../../../../Lib/src/types/FightActionType";
import { FightActionStatus } from "../../../../../Lib/src/types/FightActionStatus";
import type { FightController } from "../../../../src/core/fights/FightController";
import { buildPetFighter } from "./pets/PetFighterMocks";

const BASE_DAMAGES = 100;

function buildAction(type: FightActionType): FightAction {
	return Object.assign(new FightAction(), {
		id: `test-${type}`,
		type
	});
}

describe("damage multiplier limited to an action type", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it.each([
		[FightActionType.PHYSICAL, 120],
		[FightActionType.MAGIC, BASE_DAMAGES],
		[FightActionType.DISTANCE, BASE_DAMAGES]
	])("a physical bonus of 20 percent turns %s damages into %i", (type, expectedDamages) => {
		vi.spyOn(FightActionDataController, "getFightActionFunction").mockReturnValue(() => ({
			damages: BASE_DAMAGES,
			attackStatus: FightActionStatus.NORMAL
		}));
		const sender = buildPetFighter();
		const receiver = buildPetFighter();
		sender.applyDamageMultiplier(1.2, 1, FightActionType.PHYSICAL);

		const result = buildAction(type).use(sender, receiver, 1, {} as FightController);

		expect(result.damages).toBe(expectedDamages);
		expect(receiver.getEnergy()).toBe(receiver.getMaxEnergy() - expectedDamages);
	});

	it("keeps the multipliers without type applying to every action", () => {
		const fighter = buildPetFighter();
		fighter.applyDamageMultiplier(1.5, 1);
		fighter.applyDamageMultiplier(1.2, 1, FightActionType.PHYSICAL);

		expect(fighter.getDamageMultiplier()).toBe(1.5);
		expect(fighter.getActionTypeDamageMultiplier(FightActionType.PHYSICAL)).toBe(1.2);
	});
});
