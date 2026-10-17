import {
	describe, expect, it, vi
} from "vitest";
import { GDPRAnonymizer } from "../../../../src/commands/admin/gdpr/GDPRAnonymizer";
import { exportLogsPets } from "../../../../src/commands/admin/gdpr/exporters/LogsPetsExporter";

const modelMocks = vi.hoisted(() => ({
	petSells: vi.fn().mockResolvedValue([]),
	expeditions: vi.fn().mockResolvedValue([]),
	unlocks: vi.fn().mockResolvedValue([]),
	nicknames: vi.fn().mockResolvedValue([]),
	frees: vi.fn().mockResolvedValue([]),
	loveChanges: vi.fn().mockResolvedValue([]),
	transfers: vi.fn().mockResolvedValue([])
}));

vi.mock("../../../../src/core/database/logs/models/LogsPetsSells", () => ({
	LogsPetsSells: { findAll: modelMocks.petSells }
}));
vi.mock("../../../../src/core/database/logs/models/LogsExpeditions", () => ({
	LogsExpeditions: { findAll: modelMocks.expeditions }
}));
vi.mock("../../../../src/core/database/logs/models/LogsUnlocks", () => ({
	LogsUnlocks: { findAll: modelMocks.unlocks }
}));
vi.mock("../../../../src/core/database/logs/models/LogsPetsNicknames", () => ({
	LogsPetsNicknames: { findAll: modelMocks.nicknames }
}));
vi.mock("../../../../src/core/database/logs/models/LogsPetsFrees", () => ({
	LogsPetsFrees: { findAll: modelMocks.frees }
}));
vi.mock("../../../../src/core/database/logs/models/LogsPetsLovesChanges", () => ({
	LogsPetsLovesChanges: { findAll: modelMocks.loveChanges }
}));
vi.mock("../../../../src/core/database/logs/models/LogsPetsTransfers", () => ({
	LogsPetsTransfers: { findAll: modelMocks.transfers }
}));

describe("GDPR pet logs export", () => {
	it("filters ownership-sensitive histories by the acting player", async () => {
		const logsPlayerId = 42;

		await exportLogsPets(logsPlayerId, new GDPRAnonymizer(1, "player-keycloak-id"), {});

		const expectedQuery = {
			where: { playerId: logsPlayerId },
			limit: 5000,
			offset: 0
		};
		expect(modelMocks.nicknames).toHaveBeenCalledWith(expectedQuery);
		expect(modelMocks.frees).toHaveBeenCalledWith(expectedQuery);
		expect(modelMocks.loveChanges).toHaveBeenCalledWith(expectedQuery);
		expect(modelMocks.transfers).toHaveBeenCalledWith(expectedQuery);
	});
});
