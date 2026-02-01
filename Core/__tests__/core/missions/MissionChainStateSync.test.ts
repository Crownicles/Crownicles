import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MissionsController } from "../../../src/core/missions/MissionsController";
import Player from "../../../src/core/database/game/models/Player";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import type { CrowniclesPacket } from "@crownicles/lib";

// Mock crowniclesInstance with all required logsDatabase methods
vi.mock("../../../src/index", () => ({
	crowniclesInstance: {
		logsDatabase: {
			logMoneyChange: vi.fn().mockResolvedValue(undefined),
			logScoreChange: vi.fn().mockResolvedValue(undefined),
			logExperienceChange: vi.fn().mockResolvedValue(undefined),
			logLevelChange: vi.fn().mockResolvedValue(undefined),
			logTokensChange: vi.fn().mockResolvedValue(undefined)
		}
	}
}));

/**
 * This test suite verifies that the Object.assign pattern in Player methods
 * correctly synchronizes state when MissionsController.update returns modified values.
 *
 * WHY this pattern is critical:
 * When MissionsController.update is called, completing a mission can trigger rewards
 * (XP, money, points) which may complete OTHER missions (chain reaction).
 * The returned Player object contains these updated values.
 * Without Object.assign(this, ...), the original player instance loses these changes.
 *
 * Example bug scenario without Object.assign:
 * 1. Player earns 100 money → triggers "earnMoney" mission
 * 2. "earnMoney" mission completes → gives +25 XP as reward
 * 3. The +25 XP triggers "earnXP" mission and is reflected in returned newPlayer
 * 4. BUT the original 'this' player never receives the +25 XP
 * 5. Result: player.experience is out of sync with what was saved to DB
 */
describe("Mission chain state synchronization", () => {
	let response: CrowniclesPacket[];

	beforeEach(() => {
		response = [];
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	/**
	 * Creates a mock Player object that has the real methods from Player.prototype
	 * but with mocked dependencies
	 */
	function createTestPlayer(overrides: Partial<{
		money: number;
		experience: number;
		score: number;
		weeklyScore: number;
		level: number;
		keycloakId: string;
	}> = {}): Player {
		const playerData = {
			id: 1,
			keycloakId: overrides.keycloakId ?? "test-keycloak-id",
			money: overrides.money ?? 1000,
			experience: overrides.experience ?? 500,
			score: overrides.score ?? 100,
			weeklyScore: overrides.weeklyScore ?? 0,
			level: overrides.level ?? 10,
			// Mock methods that interact with DB
			setMoney: vi.fn(),
			setScore: vi.fn().mockResolvedValue(undefined),
			addWeeklyScore: vi.fn(),
			needLevelUp: vi.fn().mockReturnValue(false),
			save: vi.fn().mockResolvedValue(undefined),
			toJSON: function() {
				return { ...this };
			}
		};

		// Create a player object with real methods bound to our mock data
		const player = Object.create(Player.prototype);
		Object.assign(player, playerData);

		return player as Player;
	}

	describe("Player.addMoney", () => {
		it("should sync experience changes from mission rewards when earning money", async () => {
			const player = createTestPlayer({ money: 1000, experience: 500 });
			const originalExperience = player.experience;

			// Mock MissionsController.update to simulate a mission completing and giving XP
			vi.spyOn(MissionsController, "update").mockImplementation(async (inputPlayer) => {
				// Simulate what happens when a mission completes:
				// The returned player has modified experience (mission reward)
				const modifiedPlayer = createTestPlayer({
					...inputPlayer,
					money: inputPlayer.money,
					experience: inputPlayer.experience + 25 // Mission reward: +25 XP
				});
				return modifiedPlayer;
			});

			// Call the actual addMoney method
			await player.addMoney({
				amount: 100,
				response,
				reason: NumberChangeReason.SMALL_EVENT
			});

			// CRITICAL: This assertion verifies Object.assign is working
			// Without Object.assign(this, newPlayer), player.experience would still be 500
			expect(player.experience).toBe(originalExperience + 25);
			expect(player.money).toBe(1100);
		});

		it("should NOT call MissionsController.update when losing money", async () => {
			const player = createTestPlayer({ money: 1000 });

			const updateSpy = vi.spyOn(MissionsController, "update").mockResolvedValue(player);

			await player.addMoney({
				amount: -100,
				response,
				reason: NumberChangeReason.SMALL_EVENT
			});

			// Negative amounts should not trigger mission updates
			expect(updateSpy).not.toHaveBeenCalled();
			expect(player.money).toBe(900);
		});

		it("should handle chain reactions where multiple missions complete", async () => {
			const player = createTestPlayer({
				money: 1000,
				experience: 500,
				score: 100
			});

			// Mock: returns player with +25 XP and +10 score (from chain reaction)
			vi.spyOn(MissionsController, "update").mockImplementation(async (inputPlayer) => {
				return createTestPlayer({
					...inputPlayer,
					money: inputPlayer.money,
					experience: inputPlayer.experience + 25,
					score: inputPlayer.score + 10 // Also got score from a chain reaction
				});
			});

			await player.addMoney({
				amount: 100,
				response,
				reason: NumberChangeReason.SMALL_EVENT
			});

			// Both changes should be synced to the original player
			expect(player.experience).toBe(525);
			expect(player.score).toBe(110);
			expect(player.money).toBe(1100);
		});
	});

	describe("Player.addScore", () => {
		it("should sync changes from mission rewards when earning score", async () => {
			const player = createTestPlayer({ score: 100, experience: 500 });
			const originalExperience = player.experience;

			vi.spyOn(MissionsController, "update").mockImplementation(async (inputPlayer) => {
				return createTestPlayer({
					...inputPlayer,
					score: inputPlayer.score,
					experience: inputPlayer.experience + 15 // Mission reward
				});
			});

			await player.addScore({
				amount: 50,
				response,
				reason: NumberChangeReason.SMALL_EVENT
			});

			expect(player.experience).toBe(originalExperience + 15);
			expect(player.score).toBe(150);
		});
	});
});

