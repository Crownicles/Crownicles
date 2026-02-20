import {beforeEach, describe, expect, it, vi} from "vitest";
import {crowniclesInstance} from "../../../../src";
import {TravelTime} from "../../../../src/core/maps/TravelTime";
import {Effect} from "../../../../../Lib/src/types/Effect";
import {TokensConstants} from "../../../../../Lib/src/constants/TokensConstants";
import {MapLinkDataController} from "../../../../src/data/MapLink";
import {PlayerSmallEvent, PlayerSmallEvents} from "../../../../src/core/database/game/models/PlayerSmallEvent";
import {Maps} from "../../../../src/core/maps/Maps";
import {Constants} from "../../../../../Lib/src/constants/Constants";
import {NumberChangeReason} from "../../../../../Lib/src/constants/LogsConstants";
import {canUseTokensAtLocation} from "../../../../src/core/report/ReportTravelService";

// Use fake timers so that `Date.now()` and `new Date()` both return our controlled `now`
vi.useFakeTimers();

/**
 * Calculate the token cost for advancing using tokens
 * This is a copy of the function from ReportCommand.ts for testing purposes
 */
function calculateTokenCost(effectId: string, effectRemainingTime: number): number | null {
	// If player has an alteration other than occupied or no_effect, tokens cannot be used
	if (effectId !== Effect.NO_EFFECT.id && effectId !== Effect.OCCUPIED.id) {
		return null;
	}

	// Base cost is 1 token
	let cost = TokensConstants.REPORT.BASE_COST;

	// If occupied, add 1 token per 20 minutes of remaining time
	if (effectId === Effect.OCCUPIED.id) {
		const remainingMinutes = effectRemainingTime / 60_000; // Convert ms to minutes
		cost += Math.ceil(remainingMinutes / TokensConstants.REPORT.MINUTES_PER_ADDITIONAL_TOKEN);
	}

	// Cap the cost at the maximum
	return Math.min(cost, TokensConstants.REPORT.MAX_COST);
}

interface MockPlayer {
	id: number;
	keycloakId: string;
	tokens: number;
	level: number;
	effectId: string;
	effectDuration: number;
	effectEndDate: Date;
	startTravelDate: Date;
	mapLinkId: number;
	effectRemainingTime: () => number;
	currentEffectFinished: (date: Date) => boolean;
	save: ReturnType<typeof vi.fn>;
	reload: ReturnType<typeof vi.fn>;
	addTokens: (params: { amount: number; response: unknown[]; reason: NumberChangeReason }) => Promise<MockPlayer>;
	setTokens: (newTokens: number) => void;
}

/**
 * Helper to create a mock player for token tests
 */
function createMockPlayer(overrides: Partial<MockPlayer> = {}): MockPlayer {
	const now = Date.now();
	return {
		id: 1,
		keycloakId: "test-user-123",
		tokens: 10,
		level: 10, // Default level above unlock threshold
		effectId: Effect.NO_EFFECT.id,
		effectDuration: 0,
		effectEndDate: new Date(now),
		startTravelDate: new Date(now - 300_000), // Started 5 minutes ago
		mapLinkId: 1,
		effectRemainingTime: function(this: MockPlayer) {
			return Math.max(0, this.effectEndDate.valueOf() - Date.now());
		},
		currentEffectFinished: function(this: MockPlayer, date: Date) {
			return this.effectEndDate.valueOf() <= date.valueOf();
		},
		save: vi.fn().mockResolvedValue(undefined),
		reload: vi.fn().mockResolvedValue(undefined),
		addTokens: vi.fn().mockImplementation(async function(this: MockPlayer, params: { amount: number }) {
			this.tokens = Math.min(TokensConstants.MAX, Math.max(0, this.tokens + params.amount));
			return this;
		}),
		setTokens: vi.fn().mockImplementation(function(this: MockPlayer, newTokens: number) {
			this.tokens = newTokens;
		}),
		...overrides
	};
}

describe("Tokens Usage", () => {
	const now = Date.now();

	beforeEach(() => {
		vi.restoreAllMocks();
		vi.clearAllTimers();
		vi.setSystemTime(now);

		// Stub logging methods
		crowniclesInstance.logsDatabase.logTimeWarp = vi.fn().mockResolvedValue(undefined);
		crowniclesInstance.logsDatabase.logAlteration = vi.fn().mockResolvedValue(undefined);
		crowniclesInstance.logsDatabase.logTokensChange = vi.fn().mockResolvedValue(undefined);

		// MapLink stub - 10 minute trip duration
		vi.spyOn(MapLinkDataController.instance, "getById")
			.mockReturnValue({ id: 1, startMap: 1, endMap: 2, tripDuration: 10 });

		// Small event time
		vi.spyOn(Maps, "isOnPveIsland").mockReturnValue(false);
		Object.defineProperty(Constants.REPORT, "TIME_BETWEEN_MINI_EVENTS", { value: 585_000, writable: true }); // 9m45s

		// No previous small events by default
		vi.spyOn(PlayerSmallEvents, "getLastOfPlayer").mockResolvedValue(null as unknown as PlayerSmallEvent);
	});

	describe("calculateTokenCost", () => {
		describe("with NO_EFFECT", () => {
			it("should cost 1 token when player has no effect", () => {
				const cost = calculateTokenCost(Effect.NO_EFFECT.id, 0);
				expect(cost).toBe(1);
			});

			it("should still cost 1 token even with remaining time (edge case)", () => {
				// This shouldn't happen in practice, but test the behavior
				const cost = calculateTokenCost(Effect.NO_EFFECT.id, 600_000);
				expect(cost).toBe(1);
			});
		});

		describe("with OCCUPIED effect", () => {
			it("should cost 1 token for 0 minutes remaining", () => {
				const cost = calculateTokenCost(Effect.OCCUPIED.id, 0);
				expect(cost).toBe(1);
			});

			it("should cost 2 tokens for 1 minute remaining", () => {
				const cost = calculateTokenCost(Effect.OCCUPIED.id, 60_000); // 1 minute
				expect(cost).toBe(2);
			});

			it("should cost 2 tokens for exactly 28 minutes remaining", () => {
				const cost = calculateTokenCost(Effect.OCCUPIED.id, 28 * 60_000); // 28 minutes
				expect(cost).toBe(2);
			});

			it("should cost 3 tokens for 29 minutes remaining", () => {
				const cost = calculateTokenCost(Effect.OCCUPIED.id, 29 * 60_000); // 29 minutes
				expect(cost).toBe(3);
			});

			it("should cost 3 tokens for 56 minutes remaining", () => {
				const cost = calculateTokenCost(Effect.OCCUPIED.id, 56 * 60_000); // 56 minutes
				expect(cost).toBe(3);
			});

			it("should cost 4 tokens for 57 minutes remaining", () => {
				const cost = calculateTokenCost(Effect.OCCUPIED.id, 57 * 60_000); // 57 minutes
				expect(cost).toBe(4);
			});

			it("should cost 4 tokens for 84 minutes remaining", () => {
				const cost = calculateTokenCost(Effect.OCCUPIED.id, 84 * 60_000); // 84 minutes
				expect(cost).toBe(4);
			});

			it("should cost 5 tokens for 85 minutes remaining", () => {
				const cost = calculateTokenCost(Effect.OCCUPIED.id, 85 * 60_000); // 85 minutes
				expect(cost).toBe(5);
			});

			it("should cost 4 tokens for 80 minutes remaining", () => {
				const cost = calculateTokenCost(Effect.OCCUPIED.id, 80 * 60_000); // 80 minutes
				expect(cost).toBe(4);
			});

			it("should cap at 5 tokens for very long durations (120 minutes)", () => {
				const cost = calculateTokenCost(Effect.OCCUPIED.id, 120 * 60_000); // 120 minutes
				expect(cost).toBe(5);
			});

			it("should cost 2 tokens for 10 minutes remaining (screenshot scenario)", () => {
				const cost = calculateTokenCost(Effect.OCCUPIED.id, 10 * 60_000); // 10 minutes
				expect(cost).toBe(2);
			});
		});

		describe("with other effects (non-skippable)", () => {
			it("should return null for SLEEPING effect", () => {
				const cost = calculateTokenCost(Effect.SLEEPING.id, 30 * 60_000);
				expect(cost).toBeNull();
			});

			it("should return null for DRUNK effect", () => {
				const cost = calculateTokenCost(Effect.DRUNK.id, 15 * 60_000);
				expect(cost).toBeNull();
			});

			it("should return null for INJURED effect", () => {
				const cost = calculateTokenCost(Effect.INJURED.id, 45 * 60_000);
				expect(cost).toBeNull();
			});

			it("should return null for SICK effect", () => {
				const cost = calculateTokenCost(Effect.SICK.id, 20 * 60_000);
				expect(cost).toBeNull();
			});

			it("should return null for STARVING effect", () => {
				const cost = calculateTokenCost(Effect.STARVING.id, 25 * 60_000);
				expect(cost).toBeNull();
			});

			it("should return null for CONFOUNDED effect", () => {
				const cost = calculateTokenCost(Effect.CONFOUNDED.id, 10 * 60_000);
				expect(cost).toBeNull();
			});

			it("should return null for FREEZING effect", () => {
				const cost = calculateTokenCost(Effect.FREEZING.id, 35 * 60_000);
				expect(cost).toBeNull();
			});

			it("should return null for SCARED effect", () => {
				const cost = calculateTokenCost(Effect.SCARED.id, 40 * 60_000);
				expect(cost).toBeNull();
			});

			it("should return null for DEAD effect", () => {
				const cost = calculateTokenCost(Effect.DEAD.id, 0);
				expect(cost).toBeNull();
			});
		});

		describe("edge cases", () => {
			it("should handle fractional minutes by rounding up", () => {
				// 19.5 minutes should round up to cost 2 tokens
				const cost = calculateTokenCost(Effect.OCCUPIED.id, 19.5 * 60_000);
				expect(cost).toBe(2);
			});

			it("should handle very small remaining time", () => {
				// 1 second should cost 2 tokens (1 base + ceil(1/60 / 20) = 1 + 1)
				const cost = calculateTokenCost(Effect.OCCUPIED.id, 1000);
				expect(cost).toBe(2);
			});

		it("should handle exactly at boundaries", () => {
			// Exactly 0 remaining
			expect(calculateTokenCost(Effect.OCCUPIED.id, 0)).toBe(1);
			// Exactly 28 minutes
			expect(calculateTokenCost(Effect.OCCUPIED.id, 28 * 60_000)).toBe(2);
			// Exactly 56 minutes
			expect(calculateTokenCost(Effect.OCCUPIED.id, 56 * 60_000)).toBe(3);
			// Exactly 84 minutes
			expect(calculateTokenCost(Effect.OCCUPIED.id, 84 * 60_000)).toBe(4);
			// Exactly 112 minutes (beyond max, capped at 5)
			expect(calculateTokenCost(Effect.OCCUPIED.id, 112 * 60_000)).toBe(5);
		});
		});
	});

	describe("Token constants validation", () => {
		it("should have correct base cost", () => {
			expect(TokensConstants.REPORT.BASE_COST).toBe(1);
		});

			it("should have correct minutes per additional token", () => {
				expect(TokensConstants.REPORT.MINUTES_PER_ADDITIONAL_TOKEN).toBe(28);
			});		it("should have correct max cost", () => {
			expect(TokensConstants.REPORT.MAX_COST).toBe(5);
		});

		it("should have correct max tokens", () => {
			expect(TokensConstants.MAX).toBe(20);
		});

		it("should have correct daily free tokens", () => {
			expect(TokensConstants.DAILY.FREE_PER_DAY).toBe(3);
		});
	});

	describe("Token spending and advancement flow", () => {
		describe("Time travel after removing occupied effect", () => {
			it("should correctly calculate next small event time after removing effect", async () => {
				const effectDuration = 10; // 10 minutes
				const effectDurationMs = effectDuration * 60_000;
				const travelStart = now - 300_000; // Started 5 minutes ago

				const player = createMockPlayer({
					effectId: Effect.OCCUPIED.id,
					effectDuration: effectDuration,
					effectEndDate: new Date(now + effectDurationMs), // Effect ends in 10 minutes
					startTravelDate: new Date(travelStart)
				}) as any;

				// Get travel data BEFORE removing effect
				const timeDataBefore = await TravelTime.getTravelData(player, new Date(now));

				// The next small event should be after the effect ends
				expect(timeDataBefore.effectEndTime).toBe(now + effectDurationMs);
				expect(timeDataBefore.effectRemainingTime).toBe(effectDurationMs);

				// Now simulate removing the effect
				await TravelTime.removeEffect(player, NumberChangeReason.REPORT_TOKENS);

				// Get travel data AFTER removing effect
				const timeDataAfter = await TravelTime.getTravelData(player, new Date(now));

				// The effect should be gone
				expect(player.effectId).toBe(Effect.NO_EFFECT.id);
				expect(player.effectDuration).toBe(0);

				// The next small event time should be recalculated based on new state
				// This is the key fix - we need to use the UPDATED travel data
				expect(timeDataAfter.effectRemainingTime).toBe(0);
			});

			it("should advance to next small event correctly when player has no effect", async () => {
				const travelStart = now - 300_000; // Started 5 minutes ago

				const player = createMockPlayer({
					effectId: Effect.NO_EFFECT.id,
					effectDuration: 0,
					effectEndDate: new Date(travelStart), // Effect end is at travel start (no effect)
					startTravelDate: new Date(travelStart)
				}) as any;

				const timeData = await TravelTime.getTravelData(player, new Date(now));

				// Next small event should be based on max(travelStart, lastSmallEvent, effectEnd) + TIME_BETWEEN_MINI_EVENTS
				// Since effectEndDate is at travelStart and there's no small event, it's travelStart + 585_000
				expect(timeData.nextSmallEventTime).toBe(travelStart + 585_000);
			});

			it("should advance to next small event correctly when there was a previous small event", async () => {
				const travelStart = now - 600_000; // Started 10 minutes ago
				const lastSmallEventTime = now - 300_000; // Last event was 5 minutes ago

				vi.spyOn(PlayerSmallEvents, "getLastOfPlayer").mockResolvedValueOnce({
					time: lastSmallEventTime
				} as any);

				const player = createMockPlayer({
					effectId: Effect.NO_EFFECT.id,
					effectDuration: 0,
					effectEndDate: new Date(travelStart), // Effect end is at travel start
					startTravelDate: new Date(travelStart)
				}) as any;

				const timeData = await TravelTime.getTravelData(player, new Date(now));

				// Next small event should be max(travelStart, lastSmallEventTime, effectEnd) + TIME_BETWEEN_MINI_EVENTS
				// lastSmallEventTime is the most recent, so it's lastSmallEventTime + 585_000
				expect(timeData.nextSmallEventTime).toBe(lastSmallEventTime + 585_000);
			});
		});

		describe("Player token balance", () => {
			it("should correctly add tokens up to max", async () => {
				const player = createMockPlayer({ tokens: 18 });

				await player.addTokens({ amount: 5, response: [], reason: NumberChangeReason.REPORT_TOKENS });

				expect(player.tokens).toBe(TokensConstants.MAX); // Capped at 20
			});

			it("should correctly remove tokens down to 0", async () => {
				const player = createMockPlayer({ tokens: 3 });

				await player.addTokens({ amount: -5, response: [], reason: NumberChangeReason.REPORT_TOKENS });

				expect(player.tokens).toBe(0);
			});

			it("should correctly deduct exact token cost", async () => {
				const player = createMockPlayer({ tokens: 10 });

				await player.addTokens({ amount: -2, response: [], reason: NumberChangeReason.REPORT_TOKENS });

				expect(player.tokens).toBe(8);
			});

			it("should not change tokens if already at max and adding", async () => {
				const player = createMockPlayer({ tokens: TokensConstants.MAX });
				const originalTokens = player.tokens;

				await player.addTokens({ amount: 5, response: [], reason: NumberChangeReason.REPORT_TOKENS });

				expect(player.tokens).toBe(originalTokens);
			});

			it("should not change tokens if already at 0 and removing", async () => {
				const player = createMockPlayer({ tokens: 0 });

				await player.addTokens({ amount: -5, response: [], reason: NumberChangeReason.REPORT_TOKENS });

				expect(player.tokens).toBe(0);
			});
		});

		describe("Full token usage scenario (bug fix validation)", () => {
			it("should advance player to next event when using tokens with occupied effect", async () => {
				const effectDuration = 10; // 10 minutes
				const effectDurationMs = effectDuration * 60_000;
				const travelStart = now - 300_000; // Started 5 minutes ago

				const player = createMockPlayer({
					tokens: 10,
					effectId: Effect.OCCUPIED.id,
					effectDuration: effectDuration,
					effectEndDate: new Date(now + effectDurationMs), // Effect ends in 10 minutes
					startTravelDate: new Date(travelStart)
				}) as any;

				// Step 1: Calculate token cost (should be 2 for 10 minutes)
				const tokenCost = calculateTokenCost(player.effectId, player.effectRemainingTime());
				expect(tokenCost).toBe(2);

				// Step 2: Deduct tokens
				await player.addTokens({ amount: -tokenCost!, response: [], reason: NumberChangeReason.REPORT_TOKENS });
				expect(player.tokens).toBe(8);

				// Step 3: Remove effect
				await TravelTime.removeEffect(player, NumberChangeReason.REPORT_TOKENS);
				expect(player.effectId).toBe(Effect.NO_EFFECT.id);

				// Step 4: Get UPDATED travel data (THIS IS THE FIX)
				const updatedDate = new Date();
				const updatedTimeData = await TravelTime.getTravelData(player, updatedDate);

				// Step 5: The next small event time should now be based on the updated state
				// without the effect duration blocking it
				expect(updatedTimeData.effectRemainingTime).toBe(0);

				// The next small event should be accessible now
				const timeToNextEvent = updatedTimeData.nextSmallEventTime - updatedDate.valueOf();

				// Time travel to the next event
				await TravelTime.timeTravel(player, timeToNextEvent, NumberChangeReason.REPORT_TOKENS, true);

				// Verify player was moved forward in time
				expect(crowniclesInstance.logsDatabase.logTimeWarp).toHaveBeenCalled();
			});

			it("should not double-advance when effect is already gone", async () => {
				const travelStart = now - 300_000;

				const player = createMockPlayer({
					tokens: 5,
					effectId: Effect.NO_EFFECT.id,
					effectDuration: 0,
					effectEndDate: new Date(now - 60_000), // Effect already ended
					startTravelDate: new Date(travelStart)
				}) as any;

				// Token cost should be 1 (no occupied effect)
				const tokenCost = calculateTokenCost(player.effectId, 0);
				expect(tokenCost).toBe(1);

				// Get travel data
				const timeData = await TravelTime.getTravelData(player, new Date(now));

				// Time travel to next event
				const timeToNextEvent = timeData.nextSmallEventTime - now;
				await TravelTime.timeTravel(player, timeToNextEvent, NumberChangeReason.REPORT_TOKENS, true);

				// Should only have one time warp logged
				expect(crowniclesInstance.logsDatabase.logTimeWarp).toHaveBeenCalledTimes(1);
			});
		});
	});

	describe("Token eligibility checks", () => {
		it("should allow tokens when player has no effect", () => {
			const cost = calculateTokenCost(Effect.NO_EFFECT.id, 0);
			expect(cost).not.toBeNull();
		});

		it("should allow tokens when player has occupied effect", () => {
			const cost = calculateTokenCost(Effect.OCCUPIED.id, 30 * 60_000);
			expect(cost).not.toBeNull();
		});

		it("should deny tokens when player has any other effect", () => {
			const effects = [
				Effect.SLEEPING.id,
				Effect.DRUNK.id,
				Effect.INJURED.id,
				Effect.SICK.id,
				Effect.STARVING.id,
				Effect.CONFOUNDED.id,
				Effect.FREEZING.id,
				Effect.SCARED.id,
				Effect.DEAD.id
			];

			for (const effectId of effects) {
				const cost = calculateTokenCost(effectId, 30 * 60_000);
				expect(cost).toBeNull();
			}
		});

		it("should require at least tokenCost tokens to use", () => {
			const player = createMockPlayer({ tokens: 1 });
			const effectRemainingTime = 30 * 60_000; // 30 minutes -> cost 3

			const tokenCost = calculateTokenCost(Effect.OCCUPIED.id, effectRemainingTime);
			expect(tokenCost).toBe(3);
			expect(player.tokens < tokenCost!).toBe(true);
		});

		it("should allow usage when player has exactly enough tokens", () => {
			const player = createMockPlayer({ tokens: 3 });
			const effectRemainingTime = 30 * 60_000; // 30 minutes -> cost 3

			const tokenCost = calculateTokenCost(Effect.OCCUPIED.id, effectRemainingTime);
			expect(tokenCost).toBe(3);
			expect(player.tokens >= tokenCost!).toBe(true);
		});
	});

	describe("canUseTokensAtLocation", () => {
		beforeEach(() => {
			// Reset all mocks before each test
			vi.spyOn(Maps, "isOnContinent").mockReturnValue(true);
			vi.spyOn(Maps, "isOnBoat").mockReturnValue(false);
			vi.spyOn(Maps, "isOnPveIsland").mockReturnValue(false);
		});

		it("should allow tokens on the main continent at level 5 or above", () => {
			const player = createMockPlayer({ mapLinkId: 1, level: TokensConstants.LEVEL_TO_UNLOCK });
			vi.spyOn(Maps, "isOnContinent").mockReturnValue(true);
			vi.spyOn(Maps, "isOnBoat").mockReturnValue(false);
			vi.spyOn(Maps, "isOnPveIsland").mockReturnValue(false);

			expect(canUseTokensAtLocation(player as unknown as Parameters<typeof canUseTokensAtLocation>[0])).toBe(true);
		});

		it("should deny tokens when player level is below unlock threshold", () => {
			const player = createMockPlayer({ mapLinkId: 1, level: TokensConstants.LEVEL_TO_UNLOCK - 1 });
			vi.spyOn(Maps, "isOnContinent").mockReturnValue(true);
			vi.spyOn(Maps, "isOnBoat").mockReturnValue(false);
			vi.spyOn(Maps, "isOnPveIsland").mockReturnValue(false);

			expect(canUseTokensAtLocation(player as unknown as Parameters<typeof canUseTokensAtLocation>[0])).toBe(false);
		});

		it("should deny tokens when not on continent", () => {
			const player = createMockPlayer({ mapLinkId: 1, level: 10 });
			vi.spyOn(Maps, "isOnContinent").mockReturnValue(false);

			expect(canUseTokensAtLocation(player as unknown as Parameters<typeof canUseTokensAtLocation>[0])).toBe(false);
		});

		it("should deny tokens when on boat", () => {
			const player = createMockPlayer({ mapLinkId: 1, level: 10 });
			vi.spyOn(Maps, "isOnContinent").mockReturnValue(true);
			vi.spyOn(Maps, "isOnBoat").mockReturnValue(true);

			expect(canUseTokensAtLocation(player as unknown as Parameters<typeof canUseTokensAtLocation>[0])).toBe(false);
		});

		it("should deny tokens when on PVE island", () => {
			const player = createMockPlayer({ mapLinkId: 1, level: 10 });
			vi.spyOn(Maps, "isOnContinent").mockReturnValue(true);
			vi.spyOn(Maps, "isOnPveIsland").mockReturnValue(true);

			expect(canUseTokensAtLocation(player as unknown as Parameters<typeof canUseTokensAtLocation>[0])).toBe(false);
		});
	});
});
