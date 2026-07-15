import {
	afterAll, beforeEach, describe, expect, it, vi
} from "vitest";
import { Op } from "sequelize";
import { ExpeditionConstants } from "../../../../Lib/src/constants/ExpeditionConstants";
import { LogsExpeditions } from "../../../src/core/database/logs/models/LogsExpeditions";
import { LogsExpeditionLogger } from "../../../src/core/database/logs/LogsExpeditionLogger";

vi.mock("../../../src/core/database/logs/models/LogsExpeditions", () => ({
	LogsExpeditions: { count: vi.fn() }
}));

vi.mock("../../../src/core/database/logs/LogsPlayerResolver", () => ({
	findOrCreateLogsPlayer: vi.fn().mockResolvedValue({ id: 42 })
}));

describe("LogsExpeditionLogger", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 6, 15, 12));
		vi.mocked(LogsExpeditions.count).mockReset().mockResolvedValue(2);
	});

	afterAll(() => {
		vi.useRealTimers();
	});

	it("counts cancellations and recalls since the latest weekly reset", async () => {
		const count = await new LogsExpeditionLogger().countExpeditionCancellationsThisWeek("player-keycloak-id");

		expect(count).toBe(2);
		expect(LogsExpeditions.count).toHaveBeenCalledWith({
			where: {
				playerId: 42,
				action: { [Op.in]: [ExpeditionConstants.LOG_ACTION.CANCEL, ExpeditionConstants.LOG_ACTION.RECALL] },
				date: { [Op.gt]: Math.floor(new Date(2026, 6, 12, 23, 59, 59, 999).valueOf() / 1000) }
			}
		});
	});
});