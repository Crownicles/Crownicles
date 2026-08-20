import {
	describe, expect, it
} from "vitest";
import Player from "../../../src/core/database/game/models/Player";
import { missionInterface } from "../../../src/core/missions/interfaces/maxTokensReached";
import { TokensConstants } from "../../../../Lib/src/constants/TokensConstants";

/**
 * Regression test for bug #4601:
 * The `maxTokensReached` interface was missing, so the mission silently fell back to the
 * default one whose `initialNumberDone` always returns 0. A player already at the token
 * cap when the mission was assigned therefore started at 0/1.
 */
describe("maxTokensReached mission interface", () => {
	function createMockPlayer(tokens: number): Player {
		const player = Object.create(Player.prototype);
		Object.assign(player, { tokens });
		return player as Player;
	}

	it("starts completed when the player is already at the token cap", () => {
		expect(missionInterface.initialNumberDone(createMockPlayer(TokensConstants.MAX), 0)).toBe(1);
	});

	it("starts at zero when the player is below the token cap", () => {
		expect(missionInterface.initialNumberDone(createMockPlayer(TokensConstants.MAX - 1), 0)).toBe(0);
	});
});
