import {
	beforeEach, describe, expect, it, vi
} from "vitest";

vi.mock("../../../../Lib/src/logs/CrowniclesLogger", () => ({
	CrowniclesLogger: {
		warn: vi.fn(),
		info: vi.fn(),
		error: vi.fn(),
		init: vi.fn(),
		get: vi.fn()
	}
}));

vi.mock("../../../src/core/report/ReportTravelService", () => ({
	canUseTokensAtLocation: vi.fn(),
	calculateTokenCost: vi.fn()
}));

import * as ReportTravelService from "../../../src/core/report/ReportTravelService";
import { validateUseTokensRequest } from "../../../src/core/report/ReportTokenHealService";
import { USE_TOKENS_VALIDATION_REASONS } from "../../../src/core/report/ReportValidationConstants";
import { Player } from "../../../src/core/database/game/models/Player";
import { Millisecond } from "../../../../Lib/src/types/TimeTypes";

function makePlayer(tokens: number): Player {
	return { tokens } as Player;
}

describe("validateUseTokensRequest", () => {
	beforeEach(() => {
		vi.mocked(ReportTravelService.canUseTokensAtLocation).mockReset();
		vi.mocked(ReportTravelService.calculateTokenCost).mockReset();
	});

	it("returns NOT_ELIGIBLE when the player cannot use tokens at their location", () => {
		vi.mocked(ReportTravelService.canUseTokensAtLocation).mockReturnValue(false);

		const result = validateUseTokensRequest(makePlayer(10), "effect", 0 as Millisecond);

		expect(result.valid).toBe(false);
		expect(result).toMatchObject({
			valid: false,
			reason: USE_TOKENS_VALIDATION_REASONS.NOT_ELIGIBLE
		});
		expect(ReportTravelService.calculateTokenCost).not.toHaveBeenCalled();
	});

	it("returns NOT_ELIGIBLE when tokens cannot be used for the current effect", () => {
		vi.mocked(ReportTravelService.canUseTokensAtLocation).mockReturnValue(true);
		vi.mocked(ReportTravelService.calculateTokenCost).mockReturnValue({
			canUseTokens: false,
			cost: 0
		});

		const result = validateUseTokensRequest(makePlayer(10), "effect", 0 as Millisecond);

		expect(result).toMatchObject({
			valid: false,
			reason: USE_TOKENS_VALIDATION_REASONS.NOT_ELIGIBLE
		});
	});

	it("returns INSUFFICIENT_TOKENS with the token cost when the player is eligible but too poor", () => {
		vi.mocked(ReportTravelService.canUseTokensAtLocation).mockReturnValue(true);
		vi.mocked(ReportTravelService.calculateTokenCost).mockReturnValue({
			canUseTokens: true,
			cost: 4
		});

		const result = validateUseTokensRequest(makePlayer(1), "effect", 0 as Millisecond);

		expect(result).toMatchObject({
			valid: false,
			reason: USE_TOKENS_VALIDATION_REASONS.INSUFFICIENT_TOKENS,
			tokenCost: 4
		});
	});

	it("returns a valid result with the token cost when the player can afford it", () => {
		vi.mocked(ReportTravelService.canUseTokensAtLocation).mockReturnValue(true);
		vi.mocked(ReportTravelService.calculateTokenCost).mockReturnValue({
			canUseTokens: true,
			cost: 3
		});

		const result = validateUseTokensRequest(makePlayer(3), "effect", 0 as Millisecond);

		expect(result).toMatchObject({
			valid: true,
			tokenCost: 3
		});
	});
});
