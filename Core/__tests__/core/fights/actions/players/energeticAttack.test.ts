import {
	afterEach, describe, expect, it, vi
} from "vitest";
import { FightActionController } from "../../../../../src/core/fights/actions/FightActionController";
import energeticAttackUse from "../../../../../src/core/fights/actions/interfaces/players/energeticAttack";
import { FightConstants } from "../../../../../../Lib/src/constants/FightConstants";
import { FightActionStatus } from "../../../../../../Lib/src/types/FightActionStatus";
import { TestFighter } from "./TestFighter";
import type { FightAction } from "../../../../../src/data/FightAction";
import type { FightController } from "../../../../../src/core/fights/FightController";

const ACTIONS = FightConstants.FIGHT_ACTIONS.PLAYER;
const ENERGETIC_ATTACK = { id: ACTIONS.ENERGETIC_ATTACK } as FightAction;
const BASE_DAMAGE = 100;

/**
 * Energetic attack of a hurt veteran against an opponent whose last action is the given one
 */
function useEnergeticAttackAfter(opponentLastActionId: string): {
	damages: number; healed: number;
} {
	vi.spyOn(FightActionController, "applySecondaryEffects").mockReturnValue({
		damages: BASE_DAMAGE, status: FightActionStatus.NORMAL
	});
	const veteran = new TestFighter({ energy: 500 });
	const opponent = new TestFighter();
	opponent.fightActionsHistory = [{ id: opponentLastActionId } as FightAction];
	const result = energeticAttackUse(veteran, opponent, ENERGETIC_ATTACK, 3, null as unknown as FightController);
	return {
		damages: result.damages!,
		healed: veteran.getEnergy() - 500
	};
}

describe("energeticAttack", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("deals more damage to an opponent that has just rested, without healing more", () => {
		const afterRest = useEnergeticAttackAfter(ACTIONS.RESTING);
		const afterAttack = useEnergeticAttackAfter(ACTIONS.SIMPLE_ATTACK);

		expect(afterAttack.damages).toBe(BASE_DAMAGE);
		expect(afterRest.damages).toBe(BASE_DAMAGE * FightConstants.ENERGETIC_ATTACK_RESTED_TARGET_DAMAGE_MULTIPLIER);
		expect(afterRest.healed).toBe(afterAttack.healed);
	});
});
