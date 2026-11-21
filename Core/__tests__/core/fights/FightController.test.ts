import { describe, it, expect, beforeAll, beforeEach, afterEach, vi, MockInstance } from 'vitest';

const outroFightMock = vi.fn();
const displayBugFightMock = vi.fn();
const introduceFightMock = vi.fn();
const addActionToHistoryMock = vi.fn();
const displayFightActionMenuMock = vi.fn();

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

			public introduceFight = introduceFightMock;

			public displayFightStatus = vi.fn();

			public addActionToHistory = addActionToHistoryMock;

			public displayFightActionMenu = displayFightActionMenuMock;

			public displayAiChooseAction = vi.fn();

			public constructor(context: unknown, fightController: unknown) {
				this.context = context;
				this.fightController = fightController;
			}
		}
	};
});

vi.mock('../../../src/core/database/game/models/InventorySlot', () => ({
	InventorySlots: {
		getPlayerActiveObjects: vi.fn(),
		countObjectsOfPlayer: vi.fn().mockResolvedValue(0)
	}
}));

import {
	defaultFightAlterationResult, defaultHealFightAlterationResult, defaultRandomActionFightAlterationResult, FightController, getUsedGodMoves
} from '../../../src/core/fights/FightController';
import { MonsterFighter } from '../../../src/core/fights/fighter/MonsterFighter';
import { PlayerFighter } from '../../../src/core/fights/fighter/PlayerFighter';
import { AiPlayerFighter } from '../../../src/core/fights/fighter/AiPlayerFighter';
import { FightAction, FightActionDataController } from '../../../src/data/FightAction';
import { FightAlterationDataController } from '../../../src/data/FightAlteration';
import { PetAssistanceDataController } from '../../../src/data/PetAssistance';
import { registerPetBehavior } from '../../../src/core/fights/PetAssistManager';
import { FightActionStatus } from '../../../../Lib/src/types/FightActionStatus';
import { FightAlterationState } from '../../../../Lib/src/types/FightAlterationResult';
import { PetAssistanceState } from '../../../../Lib/src/types/PetAssistanceResult';
import { PetConstants } from '../../../../Lib/src/constants/PetConstants';
import { PVEConstants } from '../../../../Lib/src/constants/PVEConstants';
import { RandomUtils } from '../../../../Lib/src/utils/RandomUtils';
import { Maps } from '../../../src/core/maps/Maps';
import PetEntity from '../../../src/core/database/game/models/PetEntity';
import { Class } from '../../../src/data/Class';
import { buildLoadedGearFighter } from './actions/pets/GearFighterFixture';
import Player from '../../../src/core/database/game/models/Player';
import { ClassDataController } from '../../../src/data/Class';
import { StatValues } from '../../../../Lib/src/types/StatValues';
import { FighterStatus } from '../../../src/core/fights/FighterStatus';
import { TestFighter } from './actions/players/TestFighter';
import { FightAlterations } from '../../../src/core/fights/actions/FightAlterations';
import outOfBreath from '../../../src/core/fights/actions/interfaces/alterations/outOfBreath';
import { CrowniclesLogger } from '../../../../Lib/src/logs/CrowniclesLogger';
import { FightOvertimeBehavior } from '../../../src/core/fights/FightOvertimeBehavior';
import { FightConstants } from '../../../../Lib/src/constants/FightConstants';
import { FightStatModifierOperation } from '../../../../Lib/src/types/FightStatModifierOperation';
import {
	CrowniclesPacket, PacketContext
} from '../../../../Lib/src/packets/CrowniclesPacket';
import {
	PostFightPetLoveOutcome, PostFightPetLoveOutcomes
} from '../../../../Lib/src/constants/PetConstants';
import {
	fightActionById, fightAlterationById, monsterById, required
} from './FightTestData';

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

// Damage dealt by every fight action of these tests: the fight flow does not depend on what the actions do
const ACTION_DAMAGE = 10;
const PLAYER_ACTIONS = FightConstants.FIGHT_ACTIONS.PLAYER;
const CAPTAIN_CROW = monsterById('captainCrow');

function fightAction(id: string): FightAction {
	return fightActionById(id);
}

type PveFight = {
	fight: FightController;
	player: PlayerFighter;
	monster: MonsterFighter;
	response: CrowniclesPacket[];
};

type PveFightSetup = {
	playerSpeed?: number;
	friendly?: boolean;
	overtimeBehavior?: FightOvertimeBehavior;
	silentMode?: boolean;
	beforeStart?: (player: PlayerFighter, monster: MonsterFighter) => void;
};

/**
 * Start a fight of a player against a level 50 monster: the faster one plays first, the player then waits for its choice
 */
async function startPveFight(setup: PveFightSetup = {}): Promise<PveFight> {
	const player = await buildLoadedGearFighter({
		classStats: {
			attack: 100, defense: 100, speed: setup.playerSpeed ?? 10000
		},
		withoutConsequences: true
	});
	const monster = new MonsterFighter(50, CAPTAIN_CROW);
	setup.beforeStart?.(player, monster);
	const fight = new FightController({
		fighter1: player, fighter2: monster
	}, {
		overtimeBehavior: setup.overtimeBehavior ?? FightOvertimeBehavior.INCREASE_DAMAGE_PVE,
		context: {} as PacketContext,
		silentMode: setup.silentMode,
		friendly: setup.friendly
	});
	const response: CrowniclesPacket[] = [];
	await fight.startFight(response);
	return {
		fight, player, monster, response
	};
}

describe('FightController turns', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.spyOn(Maps, 'isOnPveIsland').mockReturnValue(false);
		vi.spyOn(FightActionDataController, 'getFightActionFunction').mockReturnValue(() => ({
			attackStatus: FightActionStatus.NORMAL, damages: ACTION_DAMAGE
		}));
		vi.spyOn(RandomUtils.crowniclesRandom, 'bool').mockReturnValue(false);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('start', () => {
		it('lets the faster fighter play first and waits for the choice of the player', async () => {
			const { fight, player, monster } = await startPveFight();

			expect([fight.getPlayingFighter(), fight.getDefendingFighter()]).toEqual([player, monster]);
			expect(fight.turn).toBe(1);
			expect(displayFightActionMenuMock).toHaveBeenCalledTimes(1);
			expect(introduceFightMock).toHaveBeenCalledWith(expect.any(Array), player, monster);
		});

		it('lets a faster monster attack before the player chooses', async () => {
			const { fight, player, monster } = await startPveFight({ playerSpeed: 1 });

			expect(player.getEnergy()).toBe(player.getMaxEnergy() - ACTION_DAMAGE);
			expect([fight.turn, fight.getPlayingFighter(), fight.getNonFightInitiatorFighter()]).toEqual([2, player, monster]);
		});

		it('draws who plays first between fighters as fast as each other', async () => {
			const asFastAs = (player: PlayerFighter, monster: MonsterFighter): void => {
				player.applySpeedModifier({
					origin: null, operation: FightStatModifierOperation.SET_VALUE, value: monster.getSpeed()
				});
			};
			const playerFirst = await startPveFight({ beforeStart: asFastAs });
			vi.mocked(RandomUtils.crowniclesRandom.bool).mockReturnValue(true);
			const monsterFirst = await startPveFight({ beforeStart: asFastAs });

			expect(playerFirst.fight.turn).toBe(1);
			expect(monsterFirst.fight.turn).toBe(2);
		});

		it('gets each fighter ready, the initiator as the attacker', async () => {
			const startFights: [string, FighterStatus][] = [];
			await startPveFight({
				beforeStart: (player, monster) => {
					vi.spyOn(player, 'startFight').mockImplementation((_view, status) => {
						startFights.push(['player', status]);
						return Promise.resolve();
					});
					vi.spyOn(monster, 'startFight').mockImplementation((_view, status) => {
						startFights.push(['monster', status]);
						return Promise.resolve();
					});
				}
			});

			expect(startFights).toEqual([['player', FighterStatus.ATTACKER], ['monster', FighterStatus.DEFENDER]]);
		});

		it('is only friendly when asked to', async () => {
			expect([(await startPveFight()).fight.friendly, (await startPveFight({ friendly: true })).fight.friendly]).toEqual([false, true]);
		});

		it('does not introduce a silent fight', async () => {
			const { fight } = await startPveFight({ silentMode: true });

			expect(introduceFightMock).not.toHaveBeenCalled();
			expect(fight.isSilentMode()).toBe(true);
		});

		it('has no playing fighter before it starts', () => {
			// The fight is never started: the initiator is never read as a player
			const fight = new FightController({
				fighter1: new TestFighter() as unknown as PlayerFighter, fighter2: new MonsterFighter(50, CAPTAIN_CROW)
			}, {
				overtimeBehavior: FightOvertimeBehavior.END_FIGHT_DRAW, context: {} as PacketContext
			});

			expect([fight.getPlayingFighter(), fight.getDefendingFighter(), fight.hadEnded()]).toEqual([null, null, true]);
		});
	});

	describe('actions', () => {
		it('pays the breath of the action, records it and gives the turn to the opponent with half its breath regeneration', async () => {
			const { fight, player, monster, response } = await startPveFight();
			vi.spyOn(monster, 'getRandomAvailableFightAction').mockReturnValue(fightAction(PLAYER_ACTIONS.NONE));
			const playerBreath = player.getBreath();
			const monsterBreath = monster.getBreath();
			const attack = fightAction(PLAYER_ACTIONS.SIMPLE_ATTACK);

			await fight.executeFightAction(attack, true, response);

			expect(player.fightActionsHistory).toEqual([attack]);
			expect(monster.getEnergy()).toBe(monster.getMaxEnergy() - ACTION_DAMAGE);
			expect(addActionToHistoryMock).toHaveBeenCalledWith(response, player, attack, expect.objectContaining({ damages: ACTION_DAMAGE }));
			expect(monster.getBreath()).toBe(monsterBreath + Math.ceil(CAPTAIN_CROW.breathRegen / 2));
			expect(player.getBreath()).toBe(Math.min(playerBreath - attack.breath + required(player.getBaseStats().breathRegen, 'breath regeneration'), player.getMaxBreath()));
			expect([fight.turn, fight.getPlayingFighter()]).toEqual([3, player]);
		});

		it('ends the boosts of the playing fighter as its turn starts', async () => {
			const { player } = await startPveFight({
				beforeStart: player => player.applyDamageMultiplier(2, 0)
			});

			expect(player.getDamageMultiplier()).toBe(1);
		});

		it('keeps the turn of the fighter when the action does not end it', async () => {
			const { fight, player, response } = await startPveFight();
			player.nextFightAction = fightAction(PLAYER_ACTIONS.CHARGING_ATTACK);

			await fight.executeFightAction(fightAction(PLAYER_ACTIONS.SIMPLE_ATTACK), false, response);

			expect([fight.turn, fight.getPlayingFighter(), player.nextFightAction?.id]).toEqual([1, player, PLAYER_ACTIONS.CHARGING_ATTACK]);
		});

		it('plays the planned action of a fighter without asking for its choice', async () => {
			const { fight, player, response } = await startPveFight({
				beforeStart: player => {
					player.nextFightAction = fightAction(PLAYER_ACTIONS.CHARGING_ATTACK);
				}
			});

			expect(player.fightActionsHistory[0].id).toBe(PLAYER_ACTIONS.CHARGING_ATTACK);
			expect(fight.turn).toBe(3);
			expect(displayFightActionMenuMock).toHaveBeenCalledTimes(1);
			expect(response).toBeDefined();
		});

		it('makes a fighter lacking breath run out of breath most of the time', async () => {
			const { fight, player, monster, response } = await startPveFight();
			player.setBreath(0);
			vi.mocked(RandomUtils.crowniclesRandom.bool).mockReturnValue(true);
			vi.spyOn(FightAlterationDataController, 'getFightAlterationFunction').mockReturnValue(outOfBreath);

			await fight.executeFightAction(fightAction(PLAYER_ACTIONS.SIMPLE_ATTACK), true, response);

			expect(player.fightActionsHistory[0].id).toBe(FightConstants.FIGHT_ACTIONS.ALTERATION.OUT_OF_BREATH);
			expect(monster.getEnergy()).toBe(monster.getMaxEnergy());
			expect(RandomUtils.crowniclesRandom.bool).toHaveBeenCalledWith(FightConstants.OUT_OF_BREATH_FAILURE_PROBABILITY);
		});

		it('otherwise lets the fighter lacking breath act with all its remaining breath', async () => {
			const { fight, player, monster, response } = await startPveFight();
			player.setBreath(1);

			await fight.executeFightAction(fightAction(PLAYER_ACTIONS.SIMPLE_ATTACK), true, response);

			expect(player.fightActionsHistory[0].id).toBe(PLAYER_ACTIONS.SIMPLE_ATTACK);
			expect(monster.getEnergy()).toBe(monster.getMaxEnergy() - ACTION_DAMAGE);
			expect(player.getBreath()).toBe(player.getBaseStats().breathRegen);
		});
	});

	describe('end', () => {
		it('ends the fight when a fighter is knocked out, the other being the winner', async () => {
			const { fight, player, monster, response } = await startPveFight();
			const endCallback = vi.fn().mockResolvedValue(undefined);
			fight.setEndCallback(endCallback);
			monster.damage(monster.getEnergy() - ACTION_DAMAGE);
			const playerEnd = vi.spyOn(player, 'endFight');
			const monsterEnd = vi.spyOn(monster, 'endFight');
			const playerUnblock = vi.spyOn(player, 'unblock');

			await fight.executeFightAction(fightAction(PLAYER_ACTIONS.SIMPLE_ATTACK), true, response);

			expect([fight.hadEnded(), fight.getWinnerFighter(), fight.getLooserFighter(), fight.isADraw()]).toEqual([true, player, monster, false]);
			expect(outroFightMock).toHaveBeenCalledWith(response, monster, player, false);
			expect(endCallback).toHaveBeenCalledWith(fight, response);
			expect(fight.turn).toBe(1);
			expect(playerEnd).toHaveBeenCalledWith(true, response, false, 1);
			expect(monsterEnd).toHaveBeenCalledWith(false, response, false, 1);
			expect(playerUnblock).toHaveBeenCalled();
		});

		it('ends a fight limited in turns as a draw once the last turn is played', async () => {
			const { fight, monster, response } = await startPveFight({ overtimeBehavior: FightOvertimeBehavior.END_FIGHT_DRAW });
			const monsterAttack = monster.getAttack();
			fight.turn = FightConstants.MAX_TURNS - 2;
			await fight.executeFightAction(fightAction(PLAYER_ACTIONS.SIMPLE_ATTACK), true, response);
			expect([fight.hadEnded(), fight.turn]).toEqual([false, FightConstants.MAX_TURNS]);
			const monsterActions = monster.fightActionsHistory.length;

			await fight.executeFightAction(fightAction(PLAYER_ACTIONS.SIMPLE_ATTACK), true, response);

			expect([fight.hadEnded(), fight.isADraw(), monster.fightActionsHistory.length]).toEqual([true, true, monsterActions]);
			expect(monster.getAttack()).toBe(monsterAttack);
		});

		it('does not execute any action once the fight has ended', async () => {
			const { fight, player, monster, response } = await startPveFight();
			await fight.endFight(response);

			await fight.executeFightAction(fightAction(PLAYER_ACTIONS.SIMPLE_ATTACK), true, response);

			expect([player.fightActionsHistory, monster.getEnergy()]).toEqual([[], monster.getMaxEnergy()]);
		});

		it('brings a negative energy back to zero when the fight ends', async () => {
			const { fight, monster, response } = await startPveFight();
			monster.setBaseEnergy(-20);

			await fight.endFight(response);

			expect(monster.getEnergy()).toBe(0);
		});

		it('kills the player and ends the fight as bugged when its choice cannot be asked', async () => {
			displayFightActionMenuMock.mockImplementationOnce(() => {
				throw new Error('Message deleted');
			});
			vi.spyOn(CrowniclesLogger, 'errorWithObj').mockImplementation(() => undefined);
			let playerEnd: MockInstance<PlayerFighter['endFight']> | undefined;
			const { fight, player, monster } = await startPveFight({
				beforeStart: player => {
					playerEnd = vi.spyOn(player, 'endFight');
				}
			});

			expect(playerEnd).toHaveBeenCalledWith(false, expect.any(Array), true, 1);

			expect(displayBugFightMock).toHaveBeenCalledTimes(1);
			expect([player.isDead(), monster.isDead(), fight.hadEnded()]).toEqual([true, false, true]);
		});
	});

	describe('alterations', () => {
		it('makes the alteration of the playing fighter happen before its action', async () => {
			const { fight, player, monster, response } = await startPveFight();
			monster.newAlteration(fightAlterationById(FightAlterations.STUNNED));
			vi.spyOn(FightAlterationDataController, 'getFightAlterationFunction').mockReturnValue(() => ({
				state: FightAlterationState.ACTIVE, damages: ACTION_DAMAGE
			}));

			await fight.executeFightAction(fightAction(PLAYER_ACTIONS.SIMPLE_ATTACK), true, response);

			expect(monster.getEnergy()).toBe(monster.getMaxEnergy() - 2 * ACTION_DAMAGE);
			expect(monster.alterationTurn).toBe(1);
			expect(addActionToHistoryMock).toHaveBeenCalledWith(response, monster, monster.alteration, {
				state: FightAlterationState.ACTIVE, damages: ACTION_DAMAGE
			});
			expect(player.getEnergy()).toBe(player.getMaxEnergy() - ACTION_DAMAGE);
		});

		it('ends the fight when the alteration knocks out the playing fighter', async () => {
			const { fight, player, monster, response } = await startPveFight();
			monster.newAlteration(fightAlterationById(FightAlterations.POISONED));
			monster.damage(monster.getEnergy() - ACTION_DAMAGE - 1);
			vi.spyOn(FightAlterationDataController, 'getFightAlterationFunction').mockReturnValue(() => ({
				state: FightAlterationState.ACTIVE, damages: ACTION_DAMAGE
			}));

			await fight.executeFightAction(fightAction(PLAYER_ACTIONS.SIMPLE_ATTACK), true, response);

			expect([monster.isDead(), fight.getWinnerFighter(), monster.fightActionsHistory]).toEqual([true, player, []]);
		});
	});

	describe('rage', () => {
		it('makes an enraged player explode against a monster on its first turn, before choosing its action', async () => {
			const { player, monster } = await startPveFight({
				beforeStart: player => {
					player.player.rage = 5;
				}
			});

			expect(player.fightActionsHistory.map(action => action.id)).toEqual([PLAYER_ACTIONS.RAGE_EXPLOSION]);
			expect(monster.getEnergy()).toBe(monster.getMaxEnergy() - ACTION_DAMAGE);
			expect(displayFightActionMenuMock).toHaveBeenCalledTimes(1);
		});

		it('only makes the player explode once, on its first turn', async () => {
			const { fight, player, response } = await startPveFight({
				beforeStart: player => {
					player.player.rage = 5;
				}
			});

			await fight.executeFightAction(fightAction(PLAYER_ACTIONS.SIMPLE_ATTACK), true, response);

			expect(player.fightActionsHistory.map(action => action.id)).toEqual([PLAYER_ACTIONS.RAGE_EXPLOSION, PLAYER_ACTIONS.SIMPLE_ATTACK]);
		});

		it('does not ask for the choice of a player whose explosion knocked out the monster', async () => {
			const { fight, player } = await startPveFight({
				beforeStart: (player, monster) => {
					player.player.rage = 5;
					monster.damage(monster.getEnergy() - ACTION_DAMAGE);
				}
			});

			expect([fight.getWinnerFighter(), displayFightActionMenuMock.mock.calls.length]).toEqual([player, 0]);
		});

		it('does not make a calm player explode', async () => {
			const { player } = await startPveFight({
				beforeStart: player => {
					player.player.rage = 0;
				}
			});

			expect(player.fightActionsHistory).toEqual([]);
		});
	});

	describe('overtime', () => {
		it('makes the monster stronger every turn after the turn limit of a fight against a monster', async () => {
			const { fight, player, monster, response } = await startPveFight();
			const playerAttack = player.getAttack();
			const baseStats = [monster.getAttack(), monster.getDefense(), monster.getSpeed()];
			fight.turn = FightConstants.MAX_TURNS - 2;

			await fight.executeFightAction(fightAction(PLAYER_ACTIONS.SIMPLE_ATTACK), true, response);

			expect([monster.getAttack(), monster.getDefense(), monster.getSpeed()]).toEqual(baseStats.map(stat => Math.round(stat * 1.2)));
			expect(monster.getDamageMultiplier()).toBe(1.2);
			expect([player.getAttack(), player.getDamageMultiplier()]).toEqual([playerAttack, 1]);
		});

		it('stops raising the stats of the monster after a while but keeps raising its damage', async () => {
			const { fight, monster, response } = await startPveFight();
			const baseAttack = monster.getAttack();
			fight.turn = FightConstants.MAX_TURNS + PVEConstants.DAMAGE_INCREASED_DURATION - 1;

			await fight.executeFightAction(fightAction(PLAYER_ACTIONS.SIMPLE_ATTACK), true, response);

			// Raised once at the start of the turn of the monster and once at the start of the turn of the player
			expect(monster.getAttack()).toBe(baseAttack);
			expect(monster.getDamageMultiplier()).toBeCloseTo(1.44);
		});

		it('does not raise the monster stats before the turn limit', async () => {
			const { fight, monster, response } = await startPveFight();
			const baseAttack = monster.getAttack();
			fight.turn = FightConstants.MAX_TURNS - 3;

			await fight.executeFightAction(fightAction(PLAYER_ACTIONS.SIMPLE_ATTACK), true, response);

			expect([monster.getAttack(), monster.getDamageMultiplier()]).toEqual([baseAttack, 1]);
		});
	});

	describe('pet assistance', () => {
		const ASSISTING_PET_TYPE = 9001;
		const PET_DAMAGE = 7;

		function giveAssistingPet(player: PlayerFighter, lovePoints = 0): void {
			player.pet = Object.assign(Object.create(PetEntity.prototype) as PetEntity, {
				typeId: ASSISTING_PET_TYPE, lovePoints
			});
		}

		beforeAll(() => {
			registerPetBehavior(ASSISTING_PET_TYPE, required(PetAssistanceDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PET.CLAWS), "pet assistance"));
		});

		it('makes the pet of the playing fighter act before it and remembers it helped', async () => {
			vi.spyOn(PetAssistanceDataController, 'getPetAssistanceFunction').mockReturnValue(() => Promise.resolve({
				assistanceStatus: PetAssistanceState.SUCCESS, damages: PET_DAMAGE
			}));
			const { player, monster } = await startPveFight({ beforeStart: player => giveAssistingPet(player) });

			expect(monster.getEnergy()).toBe(monster.getMaxEnergy() - PET_DAMAGE);
			expect(player.hasPetAssisted()).toBe(true);
		});

		it('does not count a pet doing nothing as a help', async () => {
			vi.spyOn(PetAssistanceDataController, 'getPetAssistanceFunction').mockReturnValue(() => Promise.resolve(null));
			const { player, monster } = await startPveFight({ beforeStart: player => giveAssistingPet(player) });

			expect(monster.getEnergy()).toBe(monster.getMaxEnergy());
			expect(player.hasPetAssisted()).toBe(false);
		});

		it('ends the fight when the pet knocks out the opponent', async () => {
			vi.spyOn(PetAssistanceDataController, 'getPetAssistanceFunction').mockReturnValue(() => Promise.resolve({
				assistanceStatus: PetAssistanceState.SUCCESS, damages: 100000
			}));
			const { fight, player } = await startPveFight({ beforeStart: player => giveAssistingPet(player) });

			expect([fight.getWinnerFighter(), player.fightActionsHistory]).toEqual([player, []]);
			expect(displayFightActionMenuMock).not.toHaveBeenCalled();
		});

		it('lets the pet of an AI defender help it without being counted for the post fight love', async () => {
			vi.spyOn(PetAssistanceDataController, 'getPetAssistanceFunction').mockReturnValue(() => Promise.resolve({
				assistanceStatus: PetAssistanceState.SUCCESS, damages: PET_DAMAGE
			}));
			const attacker = await buildLoadedGearFighter({
				classStats: {
					attack: 100, defense: 100, speed: 1
				},
				withoutConsequences: true
			});
			const defenderPlayer = Object.assign(Object.create(Player.prototype) as Player, {
				id: 2, level: 50, class: 0, petId: null, fightPointsLost: 0
			});
			defenderPlayer.getMaxStatsValue = (): StatValues => ({
				attack: 100, defense: 100, speed: 10000
			});
			const defender = new AiPlayerFighter(defenderPlayer, required(ClassDataController.instance.getById(0), "class"), {
				withoutConsequences: true,
				allowPotionConsumption: false,
				preloadedPetEntity: null,
				classBehavior: { chooseAction: (): FightAction => fightAction(PLAYER_ACTIONS.SIMPLE_ATTACK) }
			});
			await defender.loadStats();
			defender.pet = Object.assign(Object.create(PetEntity.prototype) as PetEntity, {
				typeId: ASSISTING_PET_TYPE, lovePoints: 0
			});
			const fight = new FightController({
				fighter1: attacker, fighter2: defender
			}, {
				overtimeBehavior: FightOvertimeBehavior.END_FIGHT_DRAW, context: {} as PacketContext
			});

			await fight.startFight([]);

			expect(attacker.getEnergy()).toBe(attacker.getMaxEnergy() - PET_DAMAGE - ACTION_DAMAGE);
			expect(fight.getPlayingFighter()).toBe(attacker);
			expect(fight.getPostFightPetLoveChange(defender, PostFightPetLoveOutcomes.WIN)).toBeNull();
		});

		describe('love change after the fight', () => {
			async function loveChange(params: {
				lovePoints: number; assisted: boolean; outcome: PostFightPetLoveOutcome; loveRoll?: number;
			}): Promise<ReturnType<FightController['getPostFightPetLoveChange']>> {
				vi.spyOn(PetAssistanceDataController, 'getPetAssistanceFunction').mockReturnValue(() => Promise.resolve(null));
				const { fight, player } = await startPveFight({ beforeStart: player => giveAssistingPet(player, params.lovePoints) });
				if (params.assisted) {
					player.markPetAssisted();
				}
				vi.spyOn(RandomUtils, 'randInt').mockReturnValue(params.loveRoll ?? 1);
				return fight.getPostFightPetLoveChange(player, params.outcome);
			}

			it('makes an assisting pet love its owner more', async () => {
				expect(await loveChange({
					lovePoints: 10, assisted: true, outcome: PostFightPetLoveOutcomes.WIN, loveRoll: 2
				})).toEqual({
					loveChange: 2, reactionType: PetConstants.POST_FIGHT_REACTION_TYPES.LOVE_GAIN
				});
				expect(RandomUtils.randInt).toHaveBeenCalledWith(PetConstants.POST_FIGHT_LOVE_GAIN_RANGE.MIN, PetConstants.POST_FIGHT_LOVE_GAIN_RANGE.MAX + 1);
			});

			it('makes a trained pet react to a win without changing its love', async () => {
				expect(await loveChange({
					lovePoints: PetConstants.TRAINED_LOVE_THRESHOLD, assisted: false, outcome: PostFightPetLoveOutcomes.WIN
				})).toEqual({
					loveChange: 0, reactionType: PetConstants.POST_FIGHT_REACTION_TYPES.TRAINED
				});
			});

			it('does not change the love of a pet that did not help, after a loss, or when the roll gives nothing', async () => {
				expect(await loveChange({
					lovePoints: 10, assisted: false, outcome: PostFightPetLoveOutcomes.WIN
				})).toBeNull();
				expect(await loveChange({
					lovePoints: PetConstants.TRAINED_LOVE_THRESHOLD, assisted: true, outcome: PostFightPetLoveOutcomes.LOSS
				})).toBeNull();
				expect(await loveChange({
					lovePoints: 10, assisted: true, outcome: PostFightPetLoveOutcomes.WIN, loveRoll: 0
				})).toBeNull();
			});

			it('does not change the love for a monster, a fighter without pet or an AI', async () => {
				const { fight, player, monster } = await startPveFight();
				// Class reduced to what the AI fighter reads when it is built
				const aiPlayer = new AiPlayerFighter(player.player, { id: 0, fightActionsIds: [] } as unknown as Class);
				aiPlayer.pet = player.pet;
				giveAssistingPet(player, PetConstants.TRAINED_LOVE_THRESHOLD);
				aiPlayer.pet = player.pet;

				expect([
					fight.getPostFightPetLoveChange(monster, PostFightPetLoveOutcomes.WIN),
					fight.getPostFightPetLoveChange(null, PostFightPetLoveOutcomes.WIN),
					fight.getPostFightPetLoveChange(aiPlayer, PostFightPetLoveOutcomes.WIN)
				]).toEqual([null, null, null]);
				player.pet = undefined;
				expect(fight.getPostFightPetLoveChange(player, PostFightPetLoveOutcomes.WIN)).toBeNull();
			});
		});
	});
});

describe('FightController alteration results', () => {
	it('counts the god moves used by both fighters', () => {
		const sender = new TestFighter();
		const receiver = new TestFighter();
		sender.fightActionsHistory = [fightAction(PLAYER_ACTIONS.BENEDICTION), fightAction(PLAYER_ACTIONS.SIMPLE_ATTACK)];
		receiver.fightActionsHistory = [fightAction(PLAYER_ACTIONS.DIVINE_ATTACK)];

		expect(getUsedGodMoves(sender, receiver)).toBe(2);
	});

	it('heals the fighter from its alteration', () => {
		const fighter = new TestFighter();
		fighter.newAlteration(fightAlterationById(FightAlterations.POISONED));
		fighter.alterationTurn = 3;

		expect(defaultHealFightAlterationResult(fighter)).toEqual({ state: FightAlterationState.STOP });
		expect([fighter.alteration, fighter.alterationTurn]).toEqual([null, 0]);
		expect(defaultFightAlterationResult()).toEqual({ state: FightAlterationState.ACTIVE });
	});

	it('makes the fighter play a random action of its own', () => {
		const fighter = new TestFighter();
		const ownAction = fightAction(PLAYER_ACTIONS.QUICK_ATTACK);
		fighter.availableFightActions.set(ownAction.id, ownAction);

		expect(defaultRandomActionFightAlterationResult(fighter)).toEqual({ state: FightAlterationState.RANDOM_ACTION });
		expect(fighter.nextFightAction).toBe(ownAction);
	});
});
