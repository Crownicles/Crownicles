import {beforeEach, describe, expect, it, vi} from 'vitest';
import {crowniclesInstance} from '../../../src/app';
import {MapLinkDataController} from '../../../src/data/MapLink';
import {PVEConstants} from '../../../../Lib/src/constants/PVEConstants';
import {Constants} from '../../../../Lib/src/constants/Constants';
import {PlayerSmallEvents} from '../../../src/core/database/game/models/PlayerSmallEvent';
import type Player from '../../../src/core/database/game/models/Player';
import {RandomUtils} from '../../../../Lib/src/utils/RandomUtils';
import {Maps} from '../../../src/core/maps/Maps';
import {TravelTime} from '../../../src/core/maps/TravelTime';
import {Effect} from '../../../../Lib/src/types/Effect';
import {asMilliseconds} from '../../../../Lib/src/utils/TimeUtils';
import {getRewardedCityStayMinutes} from '../../../src/core/report/ReportCityStayScoreService';

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

	it('calculates clamped travel progress', () => {
		const player = {
			startTravelDate: new Date(now),
			effectEndDate: new Date(now),
			effectDuration: 0,
			mapLinkId: 5
		} as Player;

		expect(TravelTime.getTravelProgress(player, new Date(now - 60_000))).toBe(0);
		expect(TravelTime.getTravelProgress(player, new Date(now + 5 * 60_000))).toBe(0.5);
		expect(TravelTime.getTravelProgress(player, new Date(now + 15 * 60_000))).toBe(1);
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

		await TravelTime.timeTravelMilliseconds(player, asMilliseconds(500_000), 0);

		// 1 minute = 60_000ms
		expect(player.effectEndDate.valueOf()).toBe(now - 495_000);
		expect(player.startTravelDate.valueOf()).toBe(now - 505_000);
		expect(crowniclesInstance.logsDatabase.logTimeWarp).toHaveBeenCalledWith('user123', 8, 0);
	});

	it('removeEffect clears effect and moves travel start', async () => {
		const tt = vi.spyOn(TravelTime, 'timeTravelMilliseconds').mockResolvedValue();
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

	it('removeEffect keeps a non travelling player stationary', async () => {
		vi.spyOn(TravelTime, 'timeTravelMilliseconds').mockResolvedValue();
		const player: any = {
			effectRemainingTime: () => 0,
			effectDuration: 1440,
			startTravelDate: new Date(0),
			effectEndDate: new Date(now),
			effectId: 'occupied',
			save: vi.fn().mockResolvedValue(undefined)
		};

		await TravelTime.removeEffect(player, 0);

		expect(player.startTravelDate.valueOf()).toBe(0);
		expect(Maps.isTravelling(player)).toBe(false);
	});

	it('removeEffect never delays a travel with an alteration consumed before it started', async () => {
		vi.spyOn(TravelTime, 'timeTravelMilliseconds').mockResolvedValue();
		const player: any = {
			effectRemainingTime: () => 0,
			// 24h alteration entirely consumed before the travel started
			effectDuration: 1440,
			startTravelDate: new Date(now - 60_000),
			effectEndDate: new Date(now - 60_000),
			effectId: 'occupied',
			save: vi.fn().mockResolvedValue(undefined)
		};

		await TravelTime.removeEffect(player, 0);

		expect(player.startTravelDate.valueOf()).toBe(now - 60_000);
	});

	it('removeEffect does not move back a long travel when spending tokens after an old alteration (#4859)', async () => {
		const fiftyMinutes = 50 * 60_000;
		const player: any = {
			// 30 minutes occupied in the city, then a travel started 50 minutes ago: the alteration never delayed it
			effectRemainingTime: () => asMilliseconds(0),
			effectDuration: 30,
			startTravelDate: new Date(now - fiftyMinutes),
			effectEndDate: new Date(now - fiftyMinutes - 20 * 60_000),
			effectId: Effect.OCCUPIED.id,
			mapLinkId: 1,
			id: 1,
			keycloakId: 'user123',
			save: vi.fn().mockResolvedValue(undefined)
		};
		const travelEndBefore = TravelTime.getTravelDataSimplified(player, new Date(now)).travelEndTime;

		await TravelTime.removeEffect(player, 0);

		expect(player.startTravelDate.valueOf()).toBe(now - fiftyMinutes);
		expect(TravelTime.getTravelDataSimplified(player, new Date(now)).travelEndTime).toBe(travelEndBefore);
	});

	it('removeEffect never delays a travel started after the alteration when it is healed early', async () => {
		const thirtyMinutes = 30 * 60_000;
		const player: any = {
			/*
			 * A 60 minutes alteration taken while staying in the city, half of it left, and the travel
			 * just started: paying to be healed must not push the departure into the future.
			 */
			effectRemainingTime: () => asMilliseconds(thirtyMinutes),
			effectDuration: 60,
			startTravelDate: new Date(now),
			effectEndDate: new Date(now + thirtyMinutes),
			mapLinkId: 1,
			id: 1,
			keycloakId: 'user123',
			save: vi.fn().mockResolvedValue(undefined)
		};

		await TravelTime.removeEffect(player, 0);

		expect(player.startTravelDate.valueOf()).toBe(now);
	});

	it('removeEffect consumes the whole alteration of a travel it delayed', async () => {
		const thirtyMinutes = 30 * 60_000;
		const player: any = {
			// Travelling for 30 minutes under a 60 minutes alteration: none of it counted as travel time
			effectRemainingTime: () => asMilliseconds(thirtyMinutes),
			effectDuration: 60,
			startTravelDate: new Date(now - thirtyMinutes),
			effectEndDate: new Date(now + thirtyMinutes),
			mapLinkId: 1,
			id: 1,
			keycloakId: 'user123',
			save: vi.fn().mockResolvedValue(undefined)
		};

		await TravelTime.removeEffect(player, 0);

		expect(player.startTravelDate.valueOf()).toBe(now);
	});

	it('removeEffect does not reward the elapsed part of an alteration taken in the city', async () => {
		const thirtyMinutes = 30 * 60_000;
		const player: any = {
			// Staying in the city for 30 minutes under a 60 minutes alteration taken on arrival
			effectRemainingTime: () => asMilliseconds(thirtyMinutes),
			effectDuration: 60,
			startTravelDate: new Date(0),
			effectEndDate: new Date(now + thirtyMinutes),
			insideCity: true,
			cityArrivalDate: new Date(now - thirtyMinutes),
			id: 1,
			keycloakId: 'user123',
			save: vi.fn().mockResolvedValue(undefined)
		};

		await TravelTime.removeEffect(player, 0);

		expect(player.cityArrivalDate.valueOf()).toBe(now);
		expect(TravelTime.getCityStayTimeUnderEffect(player, new Date(now))).toBe(0);
	});

	it('removeEffect keeps the city arrival when the alteration ended before it', async () => {
		const player: any = {
			effectRemainingTime: () => asMilliseconds(0),
			effectDuration: 60,
			startTravelDate: new Date(0),
			effectEndDate: new Date(now - 90 * 60_000),
			insideCity: true,
			cityArrivalDate: new Date(now - 30 * 60_000),
			id: 1,
			keycloakId: 'user123',
			save: vi.fn().mockResolvedValue(undefined)
		};

		await TravelTime.removeEffect(player, 0);

		expect(player.cityArrivalDate.valueOf()).toBe(now - 30 * 60_000);
	});

	function createPlayerInCity(stayMinutes: number, effectEndMinutes: number, effectDuration: number): any {
		return {
			id: 1,
			keycloakId: 'user123',
			startTravelDate: new Date(0),
			insideCity: true,
			cityArrivalDate: new Date(now - stayMinutes * 60_000),
			effectId: Effect.SLEEPING.id,
			effectDuration,
			effectEndDate: new Date(now + effectEndMinutes * 60_000)
		};
	}

	it('a time bonus in a city is rewarded and keeps the alteration taken on arrival excluded', async () => {
		// 120 minutes in the city, the first 60 under an alteration
		const player = createPlayerInCity(120, -60, 60);
		expect(getRewardedCityStayMinutes(player, new Date(now))).toBe(60);

		await TravelTime.timeTravel(player, 120, 0);

		expect(getRewardedCityStayMinutes(player, new Date(now))).toBe(180);
	});

	it('a time bonus in a city rewards nothing while it only shortens a running alteration', async () => {
		// 30 minutes in the city under a 60 minutes alteration taken on arrival
		const player = createPlayerInCity(30, 30, 60);

		await TravelTime.timeTravel(player, 20, 0);

		expect(getRewardedCityStayMinutes(player, new Date(now))).toBe(0);
		expect(player.effectEndDate.valueOf()).toBe(now + 10 * 60_000);
		// The 10 remaining minutes stay excluded, the following 20 are rewarded
		expect(getRewardedCityStayMinutes(player, new Date(now + 30 * 60_000))).toBe(20);
	});

	it('a time bonus in a city longer than the alteration rewards the part beyond it', async () => {
		const player = createPlayerInCity(30, 30, 60);

		await TravelTime.timeTravel(player, 60, 0);

		expect(getRewardedCityStayMinutes(player, new Date(now))).toBe(30);
		expect(getRewardedCityStayMinutes(player, new Date(now + 10 * 60_000))).toBe(40);
	});

	it('a time bonus in a city is rewarded like the same time really spent there', async () => {
		// 10 minutes in the city under a 180 minutes alteration taken on arrival
		const player = createPlayerInCity(10, 170, 180);

		await TravelTime.timeTravel(player, 60, 0);
		expect(getRewardedCityStayMinutes(player, new Date(now))).toBe(0);

		await TravelTime.timeTravel(player, 140, 0);
		expect(getRewardedCityStayMinutes(player, new Date(now))).toBe(30);
		expect(getRewardedCityStayMinutes(createPlayerInCity(210, -30, 180), new Date(now))).toBe(30);
	});

	it('a time bonus does not move the city arrival of a player who left the city', async () => {
		const player = {...createPlayerInCity(10, 0, 0), insideCity: false};

		await TravelTime.timeTravel(player, 60, 0);

		expect(player.cityArrivalDate.valueOf()).toBe(now - 10 * 60_000);
	});

	it('timeTravel keeps a non travelling player stationary', async () => {		const player: any = {
			effectEndDate: new Date(now + 5_000),
			startTravelDate: new Date(0),
			id: 1,
			keycloakId: 'user123'
		};

		await TravelTime.timeTravelMilliseconds(player, asMilliseconds(-500_000), 0);

		expect(player.startTravelDate.valueOf()).toBe(0);
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
