import {beforeEach, describe, expect, it, vi} from 'vitest';
import {crowniclesInstance} from '../../../src';
import {MapLinkDataController} from '../../../src/data/MapLink';
import {PVEConstants} from '../../../../Lib/src/constants/PVEConstants';
import {Constants} from '../../../../Lib/src/constants/Constants';
import {PlayerSmallEvents} from '../../../src/core/database/game/models/PlayerSmallEvent';
import {RandomUtils} from '../../../../Lib/src/utils/RandomUtils';
import {Maps} from '../../../src/core/maps/Maps';
import {TravelTime} from '../../../src/core/maps/TravelTime';
import {Effect} from '../../../../Lib/src/types/Effect';

// Use fake timers so that `Date.now()` and `new Date()` both return our controlled `now`
vi.useFakeTimers();

describe('TravelTime', () => {
	const now = Date.now();

	beforeEach(() => {
		// Reset all mocks & timers
		vi.restoreAllMocks();
		vi.clearAllTimers();
		vi.setSystemTime(now);

		// stub out the two logging methods so they *always* return a promise
		crowniclesInstance.logsDatabase.logTimeWarp = vi.fn().mockResolvedValue(undefined);
		crowniclesInstance.logsDatabase.logAlteration = vi.fn().mockResolvedValue(undefined);

		// MapLink stub
		vi.spyOn(MapLinkDataController.instance, 'getById')
			.mockReturnValue({id: 5, startMap: 1, endMap: 2, tripDuration: 10});

		// Small‐event timers
		vi.spyOn(Maps, 'isOnPveIsland').mockReturnValue(false);
		Object.defineProperty(PVEConstants, 'TIME_BETWEEN_SMALL_EVENTS', {value: 600_000, writable: true});
		Object.defineProperty(Constants.REPORT, 'TIME_BETWEEN_MINI_EVENTS', {value: 300_000, writable: true});

		// Small events
		vi.spyOn(PlayerSmallEvents, 'getLastOfPlayer').mockResolvedValue(null);
		vi.spyOn(PlayerSmallEvents, 'calculateCurrentScore').mockResolvedValue(50);

		// Random
		vi.spyOn(RandomUtils.crowniclesRandom, 'integer').mockReturnValue(5);
	});

	it('calculates simplified travel data correctly', () => {
		const start = now - 1_000;
		const effectDurationMin = 5;
		const effectDurationMs = effectDurationMin * 60_000;
		const player: any = {
			startTravelDate: new Date(start),
			effectEndDate: new Date(start + effectDurationMs),
			effectDuration: effectDurationMin,
			mapLinkId: 1
		};
		const date = new Date(start + effectDurationMs + 2_000);
		const data = TravelTime.getTravelDataSimplified(player, date);

		expect(data.travelStartTime).toBe(start);
		expect(data.effectDuration).toBe(effectDurationMs);
		expect(data.effectStartTime).toBe(start);
		expect(data.effectEndTime).toBe(start + effectDurationMs);
		expect(data.playerTravelledTime).toBe((date.valueOf() - start) - effectDurationMs);
		expect(data.travelEndTime).toBe(start + effectDurationMs + 10 * 60_000);
	});

	it('gets travel data with small events', async () => {
		const start = now - 10_000;
		const effectDurationMin = 2;
		const effectDurationMs = effectDurationMin * 60_000;
		const lastEvent = {time: start + 1_000};

		vi.spyOn(PlayerSmallEvents, 'getLastOfPlayer').mockResolvedValueOnce(lastEvent as any);
		vi.spyOn(Maps, 'isOnPveIsland').mockReturnValueOnce(true);
		Object.defineProperty(PVEConstants, 'TIME_BETWEEN_SMALL_EVENTS', {value: 200_000, writable: true});

		const player: any = {
			id: 1,
			startTravelDate: new Date(start),
			effectEndDate: new Date(start + effectDurationMs),
			effectDuration: effectDurationMin,
			mapLinkId: 1
		};
		const result = await TravelTime.getTravelData(player, new Date(now));

		expect(result.travelStartTime).toBe(start);
		expect(result.effectEndTime).toBe(start + effectDurationMs);
		expect(result.nextSmallEventTime)
			.toBe(Math.max(start, lastEvent.time, start + effectDurationMs) + 200_000);
	});

	it('timeTravel moves dates and logs', async () => {
		const player: any = {
			effectEndDate: new Date(now + 5_000),
			startTravelDate: new Date(now - 5_000),
			id: 1,
			keycloakId: 'user123'
		};
		const small = {time: now + 3_000, save: vi.fn()};
		vi.spyOn(PlayerSmallEvents, 'getLastOfPlayer').mockResolvedValueOnce(small as any);

		await TravelTime.timeTravel(player, 5, 0);

		// 1 minute = 60_000ms
		expect(player.effectEndDate.valueOf()).toBe(now - 295_000);
		expect(player.startTravelDate.valueOf()).toBe(now - 305_000);
		expect(crowniclesInstance.logsDatabase.logTimeWarp).toHaveBeenCalledWith('user123', 5, 0);
	});

	it('timeTravel moves support milliseconds inputs', async () => {
		const player: any = {
			effectEndDate: new Date(now + 5_000),
			startTravelDate: new Date(now - 5_000),
			id: 1,
			keycloakId: 'user123'
		};
		const small = {time: now + 3_000, save: vi.fn()};
		vi.spyOn(PlayerSmallEvents, 'getLastOfPlayer').mockResolvedValueOnce(small as any);

		await TravelTime.timeTravel(player, 500_000, 0, true);

		// 1 minute = 60_000ms
		expect(player.effectEndDate.valueOf()).toBe(now - 495_000);
		expect(player.startTravelDate.valueOf()).toBe(now - 505_000);
		expect(crowniclesInstance.logsDatabase.logTimeWarp).toHaveBeenCalledWith('user123', 8, 0);
	});

	it('removeEffect clears effect and moves travel start', async () => {
		const tt = vi.spyOn(TravelTime, 'timeTravel').mockResolvedValue();
		const save = vi.fn().mockResolvedValue(undefined);
		const player: any = {
			effectRemainingTime: () => 2,
			effectDuration: 3,
			startTravelDate: new Date(now),
			effectEndDate: new Date(now + 2),
			effectId: 99,
			save
		};

		await TravelTime.removeEffect(player, 0);

		expect(tt).toHaveBeenCalledOnce();
		expect(player.effectId).toBe(Effect.NO_EFFECT.id);
		expect(player.effectDuration).toBe(0);
		expect(player.effectEndDate.valueOf()).toBe(now);
		expect(save).toHaveBeenCalledOnce();
	});

	it('applyEffect sets new effect and logs', async () => {
		const save = vi.fn().mockResolvedValue(undefined);
		const player: any = {
			effectId: Effect.NO_EFFECT.id,
			effectDuration: 0,
			effectEndDate: new Date(now),
			save,
			keycloakId: 'user123'
		};

		await TravelTime.applyEffect(player, Effect.OCCUPIED, 5, new Date(now), 0);

		expect(player.effectId).toBe(Effect.OCCUPIED.id);
		expect(player.effectDuration).toBe(5);
		expect(player.effectEndDate.valueOf()).toBe(now + 5 * 60_000);
		expect(save).toHaveBeenCalledOnce();
		expect(crowniclesInstance.logsDatabase.logAlteration).toHaveBeenCalledOnce();
	});

	it('timeTravelledToScore returns non-negative score', () => {
		const score = TravelTime.timeTravelledToScore(10);
		expect(score).toBeGreaterThanOrEqual(0);
	});

	it('joinBoatScore calculates correct score scenarios', async () => {
		vi.spyOn(TravelTime, 'getTravelDataSimplified').mockReturnValue({playerTravelledTime: 10 * 60_000} as any);
		let score = await TravelTime.joinBoatScore({} as any);
		expect(score).toBeGreaterThanOrEqual(0);

		vi.spyOn(TravelTime, 'getTravelDataSimplified').mockReturnValue({playerTravelledTime: 40 * 60_000} as any);
		score = await TravelTime.joinBoatScore({} as any);
		expect(score).toBeGreaterThanOrEqual(0);

		vi.spyOn(TravelTime, 'getTravelDataSimplified').mockReturnValue({playerTravelledTime: 70 * 60_000} as any);
		score = await TravelTime.joinBoatScore({} as any);
		expect(score).toBeGreaterThanOrEqual(0);
	});

	// New tests for small event adjustments after time travel
	it('adjusts last small event when traveling longer than alteration remaining', async () => {
		const small = { time: now, save: vi.fn().mockResolvedValue(undefined) };
		vi.spyOn(PlayerSmallEvents, 'getLastOfPlayer').mockResolvedValueOnce(small as any);
		const player: any = {
			effectEndDate: new Date(now + 5 * 60_000),
			startTravelDate: new Date(now - 5 * 60_000),
			id: 1,
			keycloakId: 'userLongTravel'
		};
		await TravelTime.timeTravel(player, 120, 0);
		const diff = now - small.time;
		expect(diff).toBeGreaterThan(10 * 60_000);
		expect(small.save).toHaveBeenCalledOnce();
	});

	it('adjusts last small event when traveling shorter equal to alteration remaining', async () => {
		const small = { time: now, save: vi.fn().mockResolvedValue(undefined) };
		vi.spyOn(PlayerSmallEvents, 'getLastOfPlayer').mockResolvedValueOnce(small as any);
		const player: any = {
			effectEndDate: new Date(now + 5 * 60_000),
			startTravelDate: new Date(now - 5 * 60_000),
			id: 1,
			keycloakId: 'userShortTravel'
		};
		await TravelTime.timeTravel(player, 10, 0);
		const diff = now - small.time;
		expect(diff).toBe(5 * 60_000);
		expect(small.save).toHaveBeenCalledOnce();
	});
});