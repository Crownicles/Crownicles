import {
	afterEach, describe, expect, it, vi
} from "vitest";

vi.mock("../../../src/core/database/game/models/PlayerBadges", () => ({
	PlayerBadgesManager: {
		hasBadge: vi.fn(),
		addBadge: vi.fn()
	}
}));

import {
	FORECAST_OFFSETS, getMarketAnalysisShopItem
} from "../../../src/core/utils/StockExchangeShopItems";
import { CommandMissionShopMarketAnalysis } from "../../../../Lib/src/packets/commands/CommandMissionShopPacket";
import {
	CrowniclesPacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";

/**
 * Number of days between a date and the next monday, when the herbalist renews its selection.
 */
function daysUntilNextMonday(date: Date): number {
	return (8 - date.getDay()) % 7 || 7;
}

const emptyContext: PacketContext = {
	keycloakId: "player",
	frontEndOrigin: "test",
	frontEndSubOrigin: "test"
};

function buildAnalysis(): CommandMissionShopMarketAnalysis {
	const response: CrowniclesPacket[] = [];
	getMarketAnalysisShopItem()
		.buyCallback(response, 1, emptyContext, 1);
	return response[0] as CommandMissionShopMarketAnalysis;
}

describe("market analysis rotation horizon", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	// The rotation search scans up to the last offset and resolves its horizon with the first one reaching that day
	it("keeps the forecast offsets sorted ascending", () => {
		expect([...FORECAST_OFFSETS].sort((a, b) => a - b)).toEqual([...FORECAST_OFFSETS]);
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
