import { describe, it, expect, beforeEach, vi } from 'vitest';

const outroFightMock = vi.fn();
const displayBugFightMock = vi.fn();

vi.mock('../../../src/core/fights/FightsManager', () => ({
	FightsManager: {
		registerFight: vi.fn().mockReturnValue('test-fight-id'),
		unregisterFight: vi.fn()
	}
}));

vi.mock('../../../src/core/fights/FightView', () => {
	return {
		FightView: class {
			public context: unknown;

			public fightController: unknown;

			public outroFight = outroFightMock;

			public displayBugFight = displayBugFightMock;

			public introduceFight = vi.fn();

			public displayFightStatus = vi.fn();

			public addActionToHistory = vi.fn();

			public displayAiChooseAction = vi.fn();

			public constructor(context: unknown, fightController: unknown) {
				this.context = context;
				this.fightController = fightController;
			}
		}
	};
});

import { FightController } from '../../../src/core/fights/FightController';
import { FightOvertimeBehavior } from '../../../src/core/fights/FightOvertimeBehavior';
import { FightConstants } from '../../../../Lib/src/constants/FightConstants';
import type { PlayerFighter } from '../../../src/core/fights/fighter/PlayerFighter';

type StubFighter = PlayerFighter & {
	isDead: ReturnType<typeof vi.fn>;
	getEnergy: ReturnType<typeof vi.fn>;
	setBaseEnergy: ReturnType<typeof vi.fn>;
	getMaxEnergy: ReturnType<typeof vi.fn>;
	unblock: ReturnType<typeof vi.fn>;
	endFight: ReturnType<typeof vi.fn>;
	stats: { energy: number; maxEnergy: number };
};

function createStubFighter(label: string): StubFighter {
	const fighter = {
		label,
		unblock: vi.fn(),
		endFight: vi.fn().mockResolvedValue(undefined),
		isDead: vi.fn(),
		getEnergy: vi.fn().mockReturnValue(0),
		setBaseEnergy: vi.fn(),
		getMaxEnergy: vi.fn().mockReturnValue(1000),
		stats: { energy: 0, maxEnergy: 1000 }
	};

	return fighter as unknown as StubFighter;
}

describe('FightController endFight fallback', () => {
	beforeEach(() => {
		outroFightMock.mockClear();
	});

	it('uses opponent as displayed winner on mutual knockouts', async () => {
		const initiator = createStubFighter('initiator');
		const opponent = createStubFighter('opponent');

		initiator.isDead.mockReturnValue(true);
		opponent.isDead.mockReturnValue(true);

		const fight = new FightController(
			{ fighter1: initiator, fighter2: opponent },
			{
				overtimeBehavior: FightOvertimeBehavior.END_FIGHT_DRAW,
				context: {} as Record<string, unknown>
			}
		);

		const response: unknown[] = [];
		await fight.endFight(response);

		expect(outroFightMock).toHaveBeenCalledTimes(1);
		const [calledResponse, loser, winner, draw] = outroFightMock.mock.calls[0];
		expect(calledResponse).toBe(response);
		expect(loser).toBe(initiator);
		expect(winner).toBe(opponent);
		expect(draw).toBe(true);
	});

	it('uses opponent as displayed loser on turn limit draws', async () => {
		const initiator = createStubFighter('initiator');
		const opponent = createStubFighter('opponent');

		initiator.isDead.mockReturnValue(false);
		opponent.isDead.mockReturnValue(false);

		const fight = new FightController(
			{ fighter1: initiator, fighter2: opponent },
			{
				overtimeBehavior: FightOvertimeBehavior.END_FIGHT_DRAW,
				context: {} as Record<string, unknown>
			}
		);

		fight.turn = FightConstants.MAX_TURNS;

		const response: unknown[] = [];
		await fight.endFight(response);

		expect(outroFightMock).toHaveBeenCalledTimes(1);
		const [calledResponse, loser, winner, draw] = outroFightMock.mock.calls[0];
		expect(calledResponse).toBe(response);
		expect(loser).toBe(opponent);
		expect(winner).toBe(initiator);
		expect(draw).toBe(true);
	});
});

describe('FightController endFight re-entry', () => {
	type FinishedFightFixture = {
		fight: FightController;
		initiator: StubFighter;
		opponent: StubFighter;
		endCallback: ReturnType<typeof vi.fn>;
	};

	function buildFinishedFight(): FinishedFightFixture {
		const initiator = createStubFighter('initiator');
		const opponent = createStubFighter('opponent');
		initiator.isDead.mockReturnValue(false);
		opponent.isDead.mockReturnValue(true);

		const fight = new FightController(
			{ fighter1: initiator, fighter2: opponent },
			{
				overtimeBehavior: FightOvertimeBehavior.END_FIGHT_DRAW,
				context: {} as Record<string, unknown>
			}
		);
		const endCallback = vi.fn().mockResolvedValue(undefined);
		fight.setEndCallback(endCallback);

		return {
			fight, initiator, opponent, endCallback
		};
	}

	beforeEach(() => {
		outroFightMock.mockClear();
		displayBugFightMock.mockClear();
	});

	it('does not end the fight a second time', async () => {
		const {
			fight, initiator, opponent, endCallback
		} = buildFinishedFight();

		await fight.endFight([]);
		initiator.isDead.mockReturnValue(true);
		await fight.endFight([]);

		expect(outroFightMock).toHaveBeenCalledTimes(1);
		expect(outroFightMock.mock.calls[0][3]).toBe(false);
		expect(initiator.endFight).toHaveBeenCalledTimes(1);
		expect(initiator.endFight).toHaveBeenCalledWith(true, [], false, 1);
		expect(opponent.endFight).toHaveBeenCalledTimes(1);
		expect(endCallback).toHaveBeenCalledTimes(1);
	});

	it('ends the fight once when a second end starts before the first one is over', async () => {
		const {
			fight, initiator, opponent, endCallback
		} = buildFinishedFight();

		await Promise.all([fight.endFight([]), fight.endFight([])]);

		expect(outroFightMock).toHaveBeenCalledTimes(1);
		expect(initiator.endFight).toHaveBeenCalledTimes(1);
		expect(opponent.endFight).toHaveBeenCalledTimes(1);
		expect(endCallback).toHaveBeenCalledTimes(1);
	});

	it('ignores a bug cancellation once the fight has ended', async () => {
		const {
			fight, initiator, endCallback
		} = buildFinishedFight();

		await fight.endFight([]);
		await fight.endBugFight([]);

		expect(displayBugFightMock).not.toHaveBeenCalled();
		expect(outroFightMock).toHaveBeenCalledTimes(1);
		expect(initiator.endFight).toHaveBeenCalledTimes(1);
		expect(endCallback).toHaveBeenCalledTimes(1);
	});
});
