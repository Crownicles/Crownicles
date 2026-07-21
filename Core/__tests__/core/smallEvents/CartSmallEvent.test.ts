import {
	beforeEach, describe, expect, it, vi
} from "vitest";
import { ReactionCollectorAcceptReaction } from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import type { Player } from "../../../src/core/database/game/models/Player";
import { MapLinkDataController } from "../../../src/data/MapLink";
import { MapLocationDataController } from "../../../src/data/MapLocation";
import { smallEventFuncs } from "../../../src/core/smallEvents/cart";
import { PlayerSmallEvents } from "../../../src/core/database/game/models/PlayerSmallEvent";
import { withLockedPlayerAndMissionsSafe } from "../../../src/core/utils/withLockedPlayerAndMissionsSafe";

let capturedEndCallback: ((collector: { getFirstReaction: () => unknown }, response: unknown[]) => Promise<void>) | undefined;

vi.mock("../../../src/app", () => ({
	crowniclesInstance: {
		logsDatabase: {
			logTeleportation: vi.fn().mockResolvedValue(undefined)
		}
	}
}));

vi.mock("../../../src/core/database/game/models/PlayerSmallEvent", () => ({
	PlayerSmallEvents: {
		calculateCurrentScore: vi.fn(),
		removeSmallEventsOfPlayer: vi.fn()
	}
}));

vi.mock("../../../src/core/utils/BlockingUtils", () => ({
	BlockingUtils: {
		blockPlayerUntil: vi.fn(),
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

vi.mock("../../../src/core/utils/withLockedPlayerAndMissionsSafe", () => ({
	withLockedPlayerAndMissionsSafe: vi.fn()
}));

vi.mock("../../../src/data/MapLink", () => ({
	MapLinkDataController: {
		instance: {
			generateRandomMapLinkDifferentOfCurrent: vi.fn()
		}
	}
}));

vi.mock("../../../src/data/MapLocation", () => ({
	MapLocationDataController: {
		instance: {
			getById: vi.fn()
		}
	}
}));

vi.mock("../../../../Lib/src/utils/RandomUtils", () => ({
	RandomUtils: {
		crowniclesRandom: {
			realZeroToOneInclusive: vi.fn().mockReturnValue(0)
		}
	}
}));

describe("cart small event", () => {
	const player = {
		id: 1,
		keycloakId: "cart-player",
		money: 2000,
		mapLinkId: 1,
		addScore: vi.fn().mockResolvedValue(undefined),
		spendMoney: vi.fn(),
		save: vi.fn().mockResolvedValue(undefined)
	};

	beforeEach(() => {
		capturedEndCallback = undefined;
		vi.clearAllMocks();
		player.money = 2000;
		player.mapLinkId = 1;
		player.spendMoney.mockImplementation(async () => {
			player.mapLinkId = 1;
		});
		vi.mocked(MapLinkDataController.instance.generateRandomMapLinkDifferentOfCurrent).mockReturnValue({
			id: 2,
			endMap: 3
		} as never);
		vi.mocked(MapLocationDataController.instance.getById).mockReturnValue({ type: "plain" } as never);
		vi.mocked(PlayerSmallEvents.calculateCurrentScore).mockResolvedValue(0);
		vi.mocked(PlayerSmallEvents.removeSmallEventsOfPlayer).mockResolvedValue(undefined);
		vi.mocked(withLockedPlayerAndMissionsSafe).mockImplementation(async (_player, _caller, callback) => {
			await callback(player as Player);
		});
	});

	it("applies the destination after spendMoney reloads the player", async () => {
		smallEventFuncs.executeSmallEvent([], player as Player, {} as never);

		if (!capturedEndCallback) {
			throw new Error("Expected cart collector callback to be set");
		}
		await capturedEndCallback({
			getFirstReaction: () => ({
				reaction: { type: ReactionCollectorAcceptReaction.name }
			})
		}, []);

		expect(player.mapLinkId).toBe(2);
		expect(player.spendMoney.mock.invocationCallOrder[0])
			.toBeLessThan(player.save.mock.invocationCallOrder[0]);
	});
});
