import { Fighter } from "../../../../../src/core/fights/fighter/Fighter";

export type TestFighterStats = {
	level?: number;
	energy?: number;
	maxEnergy?: number;
	attack?: number;
	defense?: number;
	speed?: number;
	breath?: number;
};

/**
 * Minimal concrete fighter running the real stat, breath and energy logic of {@link Fighter}
 */
export class TestFighter extends Fighter {
	constructor(stats: TestFighterStats = {}) {
		super(stats.level ?? 100, []);
		this.stats = {
			energy: stats.energy ?? 1000,
			maxEnergy: stats.maxEnergy ?? 1000,
			speed: stats.speed ?? 100,
			defense: stats.defense ?? 100,
			attack: stats.attack ?? 100,
			breath: stats.breath ?? 10,
			maxBreath: 16,
			breathRegen: 4
		};
	}

	/**
	 * Boost the damage of an alteration this fighter inflicts, as a weapon damage enchantment does
	 */
	boostAlterationDamage(alterationId: string, multiplier: number): void {
		this.setAlterationMultiplier(alterationId, multiplier);
	}

	chooseAction(): Promise<void> {
		return Promise.resolve();
	}

	startFight(): Promise<void> {
		return Promise.resolve();
	}

	endFight(): Promise<void> {
		return Promise.resolve();
	}

	unblock(): void {
		// Nothing to unblock in tests
	}
}
