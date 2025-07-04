import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Fighter } from "../../../../src/core/fights/fighter/Fighter";
import { FightAction } from "../../../../src/data/FightAction";
import { FightView } from "../../../../src/core/fights/FightView";
import { FighterStatus } from "../../../../src/core/fights/FighterStatus";

// Mock necessary external modules
vi.mock("../../../../../Lib/src/utils/RandomUtils", () => ({
	RandomUtils: {
		crowniclesRandom: {
			integer: vi.fn(),
			realZeroToOneInclusive: vi.fn()
		}
	}
}));

vi.mock("../../../../../Lib/src/constants/PVEConstants", () => ({
	PVEConstants: {
		OUT_OF_BREATH_CHOOSE_PROBABILITY: 0.3
	}
}));

vi.mock("../../../../../Lib/src/constants/FightConstants", () => ({
	FightConstants: {
		FIGHT_ACTIONS: {
			ALTERATION: {
				OUT_OF_BREATH: "outOfBreath"
			}
		}
	}
}));

// Import RandomUtils after the mock to be able to use it in tests
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";

// Mock CrowniclesPacket packets
interface MockCrowniclesPacket {}

// Concrete test class that inherits from Fighter
class TestFighter extends Fighter {
	constructor(level: number, availableFightActions: FightAction[]) {
		super(level, availableFightActions);
		// Initialize base stats needed for tests
		this.stats = {
			energy: 100,
			maxEnergy: 100,
			speed: 50,
			defense: 30,
			attack: 40,
			breath: 100,
			maxBreath: 100,
			breathRegen: 10
		};
	}

	async chooseAction(fightView: FightView, response: MockCrowniclesPacket[]): Promise<void> {
		// Empty implementation for tests
	}

	async startFight(fightView: FightView, startStatus: FighterStatus): Promise<void> {
		// Empty implementation for tests
	}

	async endFight(winner: boolean, response: MockCrowniclesPacket[], bug: boolean): Promise<void> {
		// Empty implementation for tests
	}

	unblock(): void {
		// Empty implementation for tests
	}
}

// Mock fight actions for tests
class MockFightAction extends FightAction {
	constructor(id: string, breath: number, weight: number = 0) {
		super();
		this.id = id;
		// Use Object.defineProperty to define the readonly breath property
		Object.defineProperty(this, 'breath', {
			value: breath,
			writable: false,
			enumerable: true,
			configurable: false
		});
		this.setWeightForRandomSelection(weight);
	}

	// Mock the use method to avoid errors
	use(): any {
		return { damages: 0 };
	}
}

function createMockFightAction(id: string, breath: number, weight: number = 0): FightAction {
	return new MockFightAction(id, breath, weight);
}

describe('Fighter', () => {
	describe('getRandomAvailableFightAction', () => {
		let fighter: TestFighter;
		let mockActions: FightAction[];

		beforeEach(() => {
			// Create mock fight actions
			mockActions = [
				createMockFightAction('action1', 10, 0), // First action with weight 0
				createMockFightAction('action2', 20, 0), // Second action with weight 0
				createMockFightAction('action3', 30, 0), // Third action with weight 0
				createMockFightAction('action4', 40, 0)  // Fourth action with weight 0
			];

			fighter = new TestFighter(10, mockActions);
		});

		it('should select different actions when all weights are 0 (uniform random)', () => {
			// Mock RandomUtils to control random selection
			const mockInteger = vi.spyOn(RandomUtils.crowniclesRandom, 'integer');

			// Test that each action can be selected
			mockInteger.mockReturnValueOnce(0); // Select index 0
			expect(fighter.getRandomAvailableFightAction().id).toBe('action1');

			mockInteger.mockReturnValueOnce(1); // Select index 1
			expect(fighter.getRandomAvailableFightAction().id).toBe('action2');

			mockInteger.mockReturnValueOnce(2); // Select index 2
			expect(fighter.getRandomAvailableFightAction().id).toBe('action3');

			mockInteger.mockReturnValueOnce(3); // Select index 3
			expect(fighter.getRandomAvailableFightAction().id).toBe('action4');

			mockInteger.mockRestore();
		});

		it('should use weighted selection when weights are set', () => {
			// Create actions with different weights
			const weightedActions = [
				createMockFightAction('heavy', 10, 3),   // Weight 3
				createMockFightAction('medium', 20, 2),  // Weight 2
				createMockFightAction('light', 30, 1)    // Weight 1
			];

			const weightedFighter = new TestFighter(10, weightedActions);

			// Mock RandomUtils to control weighted selection
			const mockRealZeroToOne = vi.spyOn(RandomUtils.crowniclesRandom, 'realZeroToOneInclusive');

			// Total weight = 3 + 2 + 1 = 6
			// If random = 0.1 * 6 = 0.6, should select 'heavy' (0.6 < 3)
			mockRealZeroToOne.mockReturnValueOnce(0.1);
			expect(weightedFighter.getRandomAvailableFightAction().id).toBe('heavy');

			// If random = 0.7 * 6 = 4.2, should select 'medium' (4.2 - 3 = 1.2 < 2)
			mockRealZeroToOne.mockReturnValueOnce(0.7);
			expect(weightedFighter.getRandomAvailableFightAction().id).toBe('medium');

			// If random = 0.9 * 6 = 5.4, should select 'light' (5.4 - 3 - 2 = 0.4 < 1)
			mockRealZeroToOne.mockReturnValueOnce(0.9);
			expect(weightedFighter.getRandomAvailableFightAction().id).toBe('light');

			mockRealZeroToOne.mockRestore();
		});

		it('should filter actions by breath cost', () => {
			// Set fighter's breath to 25
			fighter.setBreath(25);

			const mockInteger = vi.spyOn(RandomUtils.crowniclesRandom, 'integer');
			const mockRealZeroToOne = vi.spyOn(RandomUtils.crowniclesRandom, 'realZeroToOneInclusive');

			// Mock so that OUT_OF_BREATH_CHOOSE_PROBABILITY is not triggered
			mockRealZeroToOne.mockReturnValue(1.0); // Always > probability

			// With breath = 25, only action1 (10) and action2 (20) should be available
			mockInteger.mockReturnValueOnce(0); // Select index 0 among filtered actions
			expect(fighter.getRandomAvailableFightAction().id).toBe('action1');

			mockInteger.mockReturnValueOnce(1); // Select index 1 among filtered actions
			expect(fighter.getRandomAvailableFightAction().id).toBe('action2');

			mockInteger.mockRestore();
			mockRealZeroToOne.mockRestore();
		});

		it('should handle empty available actions by using all actions', () => {
			// Create a fighter with insufficient breath for all actions
			const expensiveActions = [
				createMockFightAction('expensive1', 100, 0),
				createMockFightAction('expensive2', 200, 0)
			];

			const poorFighter = new TestFighter(10, expensiveActions);
			poorFighter.setBreath(5); // Insufficient breath for all actions

			const mockInteger = vi.spyOn(RandomUtils.crowniclesRandom, 'integer');
			const mockRealZeroToOne = vi.spyOn(RandomUtils.crowniclesRandom, 'realZeroToOneInclusive');

			// Mock so that OUT_OF_BREATH_CHOOSE_PROBABILITY is not triggered
			mockRealZeroToOne.mockReturnValue(1.0);

			// Should use all available actions as fallback
			mockInteger.mockReturnValueOnce(0);
			expect(poorFighter.getRandomAvailableFightAction().id).toBe('expensive1');

			mockInteger.mockReturnValueOnce(1);
			expect(poorFighter.getRandomAvailableFightAction().id).toBe('expensive2');

			mockInteger.mockRestore();
			mockRealZeroToOne.mockRestore();
		});

		it('should demonstrate the bug fix: no longer always returns first action', () => {
			// This test verifies the bug is fixed - we should no longer always get the first action
			const results = new Set<string>();

			// Mock to simulate different random results
			const mockInteger = vi.spyOn(RandomUtils.crowniclesRandom, 'integer');

			// Simulate multiple calls with different indices
			for (let i = 0; i < 4; i++) {
				mockInteger.mockReturnValueOnce(i);
				const selectedAction = fighter.getRandomAvailableFightAction();
				results.add(selectedAction.id);
			}

			// Verify we can get different actions, not just the first one
			expect(results.size).toBeGreaterThan(1);
			expect(results.has('action1')).toBe(true);
			expect(results.has('action2')).toBe(true);
			expect(results.has('action3')).toBe(true);
			expect(results.has('action4')).toBe(true);

			mockInteger.mockRestore();
		});

		it('should handle NaN weights correctly (real-world bug case)', () => {
			// Create mock actions with NaN weights (like in the real game)
			class NaNWeightFightAction extends FightAction {
				constructor(id: string, breath: number) {
					super();
					this.id = id;
					Object.defineProperty(this, 'breath', {
						value: breath,
						writable: false,
						enumerable: true,
						configurable: false
					});
					// Don't set weight, so getWeightForRandomSelection() will return undefined -> NaN
				}

				getWeightForRandomSelection(): number {
					return undefined as any; // Simulate real behavior that returns undefined
				}

				use(): any {
					return { damages: 0 };
				}
			}

			const nanWeightActions = [
				new NaNWeightFightAction('poisonousAttack', 10),
				new NaNWeightFightAction('breathTakingAttack', 15),
				new NaNWeightFightAction('cursedAttack', 20),
				new NaNWeightFightAction('darkAttack', 25)
			];

			const nanFighter = new TestFighter(10, nanWeightActions);

			const mockInteger = vi.spyOn(RandomUtils.crowniclesRandom, 'integer');

			// Verify each action can be selected despite NaN weights
			mockInteger.mockReturnValueOnce(0);
			expect(nanFighter.getRandomAvailableFightAction().id).toBe('poisonousAttack');

			mockInteger.mockReturnValueOnce(1);
			expect(nanFighter.getRandomAvailableFightAction().id).toBe('breathTakingAttack');

			mockInteger.mockReturnValueOnce(2);
			expect(nanFighter.getRandomAvailableFightAction().id).toBe('cursedAttack');

			mockInteger.mockReturnValueOnce(3);
			expect(nanFighter.getRandomAvailableFightAction().id).toBe('darkAttack');

			mockInteger.mockRestore();
		});

		it('should fall back to uniform selection when weights sum to NaN', () => {
			// More explicit test of the NaN case discovered in debug logs
			class UndefinedWeightAction extends MockFightAction {
				constructor(id: string, breath: number) {
					super(id, breath, 0);
				}

				getWeightForRandomSelection(): number {
					return undefined as any; // Force undefined which becomes NaN when summed
				}
			}

			const undefinedWeightActions = [
				new UndefinedWeightAction('action1', 10),
				new UndefinedWeightAction('action2', 20)
			];

			const undefinedFighter = new TestFighter(10, undefinedWeightActions);

			// Calculate weight sum to verify it's NaN
			const totalWeight = undefinedWeightActions.reduce((sum, action) => sum + action.getWeightForRandomSelection(), 0);
			expect(isNaN(totalWeight)).toBe(true);

			const mockInteger = vi.spyOn(RandomUtils.crowniclesRandom, 'integer');

			// Verify the code uses uniform selection when totalWeight is NaN
			mockInteger.mockReturnValueOnce(1);
			expect(undefinedFighter.getRandomAvailableFightAction().id).toBe('action2');

			mockInteger.mockReturnValueOnce(0);
			expect(undefinedFighter.getRandomAvailableFightAction().id).toBe('action1');

			mockInteger.mockRestore();
		});
	});
});
