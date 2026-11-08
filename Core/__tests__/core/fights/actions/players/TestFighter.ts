import { Fighter } from "../../../../../src/core/fights/fighter/Fighter";

type TestFighterStats = {
	energy?: number;
	defense?: number;
	speed?: number;
	breath?: number;
};

/**
 * Minimal concrete fighter running the real stat, breath and energy logic of {@link Fighter}
 */
export class TestFighter extends Fighter {
	constructor(stats: TestFighterStats = {}) {
		super(100, []);
		this.stats = {
			energy: stats.energy ?? 1000,
			maxEnergy: 1000,
			speed: stats.speed ?? 100,
			defense: stats.defense ?? 100,
			attack: 100,
			breath: stats.breath ?? 10,
			maxBreath: 16,
			breathRegen: 4
		};
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
