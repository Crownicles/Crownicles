import {
	beforeEach, describe, expect, it, vi
} from "vitest";
import type { PacketContext } from "../../../../Lib/src/packets/CrowniclesPacket";
import { ReactionCollectorTokenMerchantBuyReaction } from "../../../../Lib/src/packets/interaction/ReactionCollectorTokenMerchant";
import { ShopConstants } from "../../../../Lib/src/constants/ShopConstants";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import type { Player } from "../../../src/core/database/game/models/Player";
import { LogsReadRequests } from "../../../src/core/database/logs/LogsReadRequests";
import { openTokenMerchant } from "../../../src/core/report/ReportTokenMerchantService";
import { withLockedPlayerAndMissions } from "../../../src/core/utils/withLockedPlayerAndMissions";

let capturedEndCallback: ((collector: { getFirstReaction: () => unknown }, response: unknown[]) => Promise<void>) | undefined;

vi.mock("../../../src/app", () => ({
	crowniclesInstance: {
		logsDatabase: {
			logClassicalShopBuyout: vi.fn().mockResolvedValue(undefined)
		}
	}
}));

vi.mock("../../../src/core/database/logs/LogsReadRequests", () => ({
	LogsReadRequests: {
		getAmountOfTokensBoughtByPlayerToday: vi.fn(),
		getAmountOfTokensBoughtByPlayerThisWeek: vi.fn()
	}
}));

vi.mock("../../../src/core/missions/MissionsController", () => ({
	MissionsController: {
		update: vi.fn().mockResolvedValue(undefined)
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

vi.mock("../../../src/core/utils/withLockedPlayerAndMissions", () => ({
	withLockedPlayerAndMissions: vi.fn()
}));

describe("ReportTokenMerchantService", () => {
	const player = {
		id: 1,
		keycloakId: "token-buyer",
		money: 5000,
		tokens: 0,
		spendMoney: vi.fn().mockResolvedValue(undefined),
		addTokens: vi.fn().mockResolvedValue(undefined),
		save: vi.fn().mockResolvedValue(undefined)
	};

	beforeEach(() => {
		capturedEndCallback = undefined;
		vi.clearAllMocks();
		vi.mocked(LogsReadRequests.getAmountOfTokensBoughtByPlayerToday).mockResolvedValue(0);
		vi.mocked(LogsReadRequests.getAmountOfTokensBoughtByPlayerThisWeek).mockResolvedValue(0);
		vi.mocked(withLockedPlayerAndMissions).mockImplementation(async (_playerId, callback) => await callback(player as Player));
	});

	it("persists the money deduction before granting tokens", async () => {
		await openTokenMerchant(player as Player, {} as PacketContext, []);

		if (!capturedEndCallback) {
			throw new Error("Expected token merchant collector callback to be set");
		}
		const response: unknown[] = [];
		await capturedEndCallback({
			getFirstReaction: () => ({
				reaction: {
					type: ReactionCollectorTokenMerchantBuyReaction.name,
					data: { amount: 5 }
				}
			})
		}, response);

		expect(player.spendMoney).toHaveBeenCalledWith({
			amount: 5 * ShopConstants.TOKEN_PRICE,
			response,
			reason: NumberChangeReason.SHOP
		});
		expect(player.addTokens).toHaveBeenCalledWith({
			amount: 5,
			response,
			reason: NumberChangeReason.SHOP
		});
		expect(player.save).toHaveBeenCalledTimes(2);
		expect(player.spendMoney.mock.invocationCallOrder[0])
			.toBeLessThan(player.save.mock.invocationCallOrder[0]);
		expect(player.save.mock.invocationCallOrder[0])
			.toBeLessThan(player.addTokens.mock.invocationCallOrder[0]);
	});
});
