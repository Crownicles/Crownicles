import {
	afterEach, describe, expect, it, vi
} from "vitest";

vi.mock("../../../src/core/database/game/models/PlayerBadges", () => ({
	PlayerBadgesManager: {
		hasBadge: vi.fn(),
		addBadge: vi.fn()
	}
}));

import { getMarketAnalysisShopItem } from "../../../src/core/utils/StockExchangeShopItems";
import { CommandMissionShopMarketAnalysis } from "../../../../Lib/src/packets/commands/CommandMissionShopPacket";
import { CrowniclesPacket } from "../../../../Lib/src/packets/CrowniclesPacket";

/**
 * Number of days between a date and the next monday, when the herbalist renews its selection.
 */
function daysUntilNextMonday(date: Date): number {
	return (8 - date.getDay()) % 7 || 7;
}

function buildAnalysis(): CommandMissionShopMarketAnalysis {
	const response: CrowniclesPacket[] = [];
	getMarketAnalysisShopItem()
		.buyCallback(response, 1, {} as never);
	return response[0] as CommandMissionShopMarketAnalysis;
}

describe("market analysis rotation horizon", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("announces the exact day of the rotation instead of the forecast horizon", () => {
		vi.useFakeTimers();
		let checkedDays = 0;

		// Any day of the week: the rotation, when detected, always lands on the next monday
		for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
			vi.setSystemTime(new Date(2026, 7, 10 + dayOffset, 12));
			const now = new Date();
			const rotation = buildAnalysis().plantRotation;
			if (!rotation) {
				continue;
			}

			expect(rotation.daysUntilRotation).toBe(daysUntilNextMonday(now));
			expect(rotation.newPlantIds.length).toBeGreaterThan(0);
			checkedDays++;
		}

		expect(checkedDays).toBeGreaterThan(0);
	});
});
