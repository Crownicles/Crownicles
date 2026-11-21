import {
	afterEach, describe, expect, it, vi
} from "vitest";
import { MonsterFighter } from "../../../../src/core/fights/fighter/MonsterFighter";
import type { FightView } from "../../../../src/core/fights/FightView";
import type { FightController } from "../../../../src/core/fights/FightController";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";
import {
	monsterById
} from "../FightTestData";

const CAPTAIN_CROW = monsterById("captainCrow");

describe("MonsterFighter", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("only knows the attacks of its monster unlocked at its level, weighted as in the monster data", () => {
		const attacksAt = (level: number): string[] => [...new MonsterFighter(level, CAPTAIN_CROW).availableFightActions.keys()];

		expect(attacksAt(49)).toEqual(["breathTakingAttack", "cursedOfTheSea"]);
		expect(attacksAt(50)).toEqual(["breathTakingAttack", "cursedOfTheSea", "spectralRevengeAttack"]);
		expect(attacksAt(100)).toEqual(["breathTakingAttack", "fatalFlight", "cursedOfTheSea", "mutiny", "spectralRevengeAttack"]);
		expect(new MonsterFighter(100, CAPTAIN_CROW).availableFightActions.get("fatalFlight")?.getWeightForRandomSelection()).toBe(2);
	});

	it("gets stats growing with its level, shaped by the ratios of its monster", () => {
		const statsAt = (level: number): number[] => {
			const monster = new MonsterFighter(level, CAPTAIN_CROW);
			return [monster.getEnergy(), monster.getMaxEnergy(), monster.getAttack(), monster.getDefense(), monster.getSpeed()];
		};

		expect([statsAt(1), statsAt(50), statsAt(120)]).toEqual([[167, 167, 27, 9, 7], [1217, 1217, 143, 56, 38], [2095, 2095, 546, 241, 162]]);
	});

	it("starts with the breath of its monster", () => {
		const monster = new MonsterFighter(50, CAPTAIN_CROW);

		expect([monster.getBreath(), monster.getMaxBreath(), monster.getRegenBreath()]).toEqual([CAPTAIN_CROW.breath, CAPTAIN_CROW.maxBreath, CAPTAIN_CROW.breathRegen]);
	});

	it("plays one of its attacks after a short thinking time", async () => {
		const monster = new MonsterFighter(50, CAPTAIN_CROW);
		const executeFightAction = vi.fn();
		// Only the parts of the fight view the monster uses to play its action
		const fightView = {
			displayAiChooseAction: vi.fn(),
			fightController: { executeFightAction } as unknown as FightController
		};
		vi.spyOn(RandomUtils, "randInt").mockReturnValue(1000);

		await monster.chooseAction(fightView as unknown as FightView, []);

		expect(RandomUtils.randInt).toHaveBeenCalledWith(300, 1800);
		expect(fightView.displayAiChooseAction).toHaveBeenCalledWith([], 1000);
		expect([...monster.availableFightActions.values()]).toContain(executeFightAction.mock.calls[0][0]);
		expect(executeFightAction.mock.calls[0].slice(1)).toEqual([true, []]);
	});
});
