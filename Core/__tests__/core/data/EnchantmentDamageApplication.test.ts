import {
	afterEach, describe, expect, it, vi
} from "vitest";
import {
	FightAction, FightActionDataController
} from "../../../src/data/FightAction";
import {
	FightAlteration, FightAlterationDataController
} from "../../../src/data/FightAlteration";
import type { Fighter } from "../../../src/core/fights/fighter/Fighter";
import type { FightController } from "../../../src/core/fights/FightController";
import type { FightActionResult } from "../../../../Lib/src/types/FightActionResult";
import type { FightAlterationResult } from "../../../../Lib/src/types/FightAlterationResult";

const RAW_DAMAGE = 100;
const NO_FIGHT = null as unknown as FightController;

/**
 * These tests verify that the enchantment damage multipliers are actually applied to the damage flowing through
 * FightAction.use and FightAlteration.happen, not just computed. The alteration/action functions are stubbed so the
 * only thing under test is the multiplier application performed by the two entry points.
 */
describe("Enchantment damage multiplier application", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("FightAction.use", () => {
		it("scales the dealt damage by the sender's outgoing and the receiver's incoming multipliers", () => {
			vi.spyOn(FightActionDataController, "getFightActionFunction").mockReturnValue(
				() => ({ damages: RAW_DAMAGE }) as FightActionResult
			);

			const action = new FightAction();
			action.id = "testAttack";

			const receivedDamage: number[] = [];
			const sender = {
				getEnchantmentDamageDealtMultiplier: () => 1.5,
				damage: (): number => 0
			} as unknown as Fighter;
			const receiver = {
				getEnchantmentDamageTakenMultiplier: () => 0.8,
				getResistanceMultiplier: () => 1,
				getReflectedDamage: () => 0,
				damage: (value: number): number => {
					receivedDamage.push(value);
					return 0;
				}
			} as unknown as Fighter;

			const result = action.use(sender, receiver, 1, NO_FIGHT);

			// round(100 * 1.5 * 0.8) = 120
			expect(result.damages).toBe(120);
			expect(receivedDamage[0]).toBe(120);
		});

		it("leaves the damage unchanged when neither fighter has an enchantment", () => {
			vi.spyOn(FightActionDataController, "getFightActionFunction").mockReturnValue(
				() => ({ damages: RAW_DAMAGE }) as FightActionResult
			);

			const action = new FightAction();
			action.id = "testAttack";

			const sender = {
				getEnchantmentDamageDealtMultiplier: () => 1,
				damage: (): number => 0
			} as unknown as Fighter;
			const receiver = {
				getEnchantmentDamageTakenMultiplier: () => 1,
				getResistanceMultiplier: () => 1,
				getReflectedDamage: () => 0,
				damage: (): number => 0
			} as unknown as Fighter;

			const result = action.use(sender, receiver, 1, NO_FIGHT);

			expect(result.damages).toBe(RAW_DAMAGE);
		});
	});

	describe("FightAlteration.happen", () => {
		function buildAffected(takenMultiplier: number, resistanceMultiplier: number): { fighter: Fighter; receivedDamage: number[] } {
			const receivedDamage: number[] = [];
			const fighter = {
				alterationTurn: 0,
				damage: (value: number): number => {
					receivedDamage.push(value);
					return 0;
				},
				getEnchantmentDamageTakenMultiplier: () => takenMultiplier,
				getAlterationResistanceMultiplier: () => resistanceMultiplier
			} as unknown as Fighter;
			return {
				fighter, receivedDamage
			};
		}

		it("reduces the damage-over-time by the alteration resistance multiplier (opposite-element protection)", () => {
			vi.spyOn(FightAlterationDataController, "getFightAlterationFunction").mockReturnValue(
				() => ({ damages: RAW_DAMAGE }) as FightAlterationResult
			);

			const alteration = new FightAlteration();
			alteration.id = "frozen";
			const {
				fighter, receivedDamage
			} = buildAffected(1, 0.75);

			const result = alteration.happen(fighter, {} as unknown as Fighter, 1, NO_FIGHT);

			// round(100 * 1 * 0.75) = 75
			expect(result.damages).toBe(75);
			expect(receivedDamage[0]).toBe(75);
		});

		it("stacks the defense (damage taken) multiplier with the alteration resistance multiplier", () => {
			vi.spyOn(FightAlterationDataController, "getFightAlterationFunction").mockReturnValue(
				() => ({ damages: RAW_DAMAGE }) as FightAlterationResult
			);

			const alteration = new FightAlteration();
			alteration.id = "frozen";
			const {
				fighter, receivedDamage
			} = buildAffected(0.9, 0.75);

			const result = alteration.happen(fighter, {} as unknown as Fighter, 1, NO_FIGHT);

			// round(100 * 0.9 * 0.75) = 68 (67.5 rounded)
			expect(result.damages).toBe(68);
			expect(receivedDamage[0]).toBe(68);
		});
	});
});
