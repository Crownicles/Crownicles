import { describe, it, expect, beforeEach, vi } from 'vitest';

const outroFightMock = vi.fn();

vi.mock('../../../src/core/fights/FightsManager', () => ({
	FightsManager: {
		registerFight: vi.fn().mockReturnValue('test-fight-id'),
		unregisterFight: vi.fn()
	}
}));

vi.mock('../../../src/core/fights/FightView', () => {
	return {
		FightView: vi.fn().mockImplementation((context, fightController) => ({
			context,
			fightController,
			outroFight: outroFightMock,
			displayBugFight: vi.fn(),
			introduceFight: vi.fn(),
			displayFightStatus: vi.fn(),
			addActionToHistory: vi.fn(),
			displayAiChooseAction: vi.fn()
		}))
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
			FightOvertimeBehavior.END_FIGHT_DRAW,
			{} as Record<string, unknown>
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
			FightOvertimeBehavior.END_FIGHT_DRAW,
			{} as Record<string, unknown>
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
