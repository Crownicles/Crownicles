import {
	beforeEach, describe, expect, it, vi
} from "vitest";
import type {
	CrowniclesPacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { ReactionCollectorAcceptReaction } from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import {
	asMinutes, minutesToMilliseconds
} from "../../../../Lib/src/utils/TimeUtils";
import type { Player } from "../../../src/core/database/game/models/Player";
import { PlayerSmallEvents } from "../../../src/core/database/game/models/PlayerSmallEvent";
import { Maps } from "../../../src/core/maps/Maps";
import { TravelTime } from "../../../src/core/maps/TravelTime";
import { createUseTokensCollector } from "../../../src/core/report/ReportTokenHealService";
import { withLockedPlayerAndMissions } from "../../../src/core/utils/withLockedPlayerAndMissions";

let capturedEndCallback: ((collector: { getFirstReaction: () => unknown }, response: CrowniclesPacket[]) => Promise<void>) | undefined;

const OVERDUE_SMALL_EVENT_MINUTES = 82;
const TRAVELLED_MINUTES_BEFORE_TOKEN = 92;

vi.mock("../../../src/core/missions/MissionsController", () => ({
	MissionsController: {
		update: vi.fn().mockResolvedValue(undefined)
	}
}));

vi.mock("../../../src/core/utils/BlockingUtils", () => ({
	BlockingUtils: {
		blockPlayer: vi.fn(),
		unblockPlayer: vi.fn()
	}
}));

vi.mock("../../../src/core/utils/ReactionsCollector", () => ({
	ReactionCollectorInstance: class {
		constructor(_collector: unknown, _context: unknown, _options: unknown, endCallback: typeof capturedEndCallback) {
			capturedEndCallback = endCallback;
		}

		block(): this {
			return this;
		}

		build(): this {
			return this;
		}
	}
}));

vi.mock("../../../src/core/utils/withLockedPlayerAndMissions", () => ({
	withLockedPlayerAndMissions: vi.fn()
}));

describe("report token travel", () => {
	const player = {
		id: 1,
		keycloakId: "token-user",
		tokens: 10,
		effectId: "no_effect",
		effectEndDate: new Date(0),
		startTravelDate: new Date(0),
		useTokens: vi.fn().mockResolvedValue(undefined),
		save: vi.fn().mockResolvedValue(undefined)
	};

	beforeEach(() => {
		capturedEndCallback = undefined;
		vi.clearAllMocks();
		vi.mocked(withLockedPlayerAndMissions).mockImplementation(async (_playerId, callback) => await callback(player as Player));
	});

	it("does not move the player backwards when the next small event is overdue", async () => {
		const now = Date.now();
		const originalStartTravelTime = now - minutesToMilliseconds(asMinutes(TRAVELLED_MINUTES_BEFORE_TOKEN));
		player.effectEndDate = new Date(originalStartTravelTime);
		player.startTravelDate = new Date(originalStartTravelTime);
		vi.spyOn(TravelTime, "getTravelData").mockResolvedValue({
			nextSmallEventTime: now - minutesToMilliseconds(asMinutes(OVERDUE_SMALL_EVENT_MINUTES))
		} as Awaited<ReturnType<typeof TravelTime.getTravelData>>);
		vi.spyOn(PlayerSmallEvents, "getLastOfPlayer").mockResolvedValue(null);
		vi.spyOn(Maps, "isArrived").mockReturnValue(false);

		createUseTokensCollector(player as Player, 1, {} as PacketContext, []);

		if (!capturedEndCallback) {
			throw new Error("Expected use-tokens collector callback to be set");
		}
		await capturedEndCallback({
			getFirstReaction: () => ({ reaction: { type: ReactionCollectorAcceptReaction.name } })
		}, []);

		expect(player.startTravelDate.valueOf()).toBe(originalStartTravelTime);
	});
});