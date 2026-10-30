import {
	beforeEach, describe, expect, it, vi
} from "vitest";
import type { Player } from "../../../src/core/database/game/models/Player";
import { smallEventFuncs } from "../../../src/core/smallEvents/messageRecipient";
import { PlayerMessageDeliveries } from "../../../src/core/database/game/models/PlayerMessageDelivery";
import { Maps } from "../../../src/core/maps/Maps";
import { SmallEventConstants } from "../../../../Lib/src/constants/SmallEventConstants";
import { SmallEventMessageRecipientPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventMessageRecipientPacket";
import { CrowniclesPacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { withLockedPlayerAndMissionsSafe } from "../../../src/core/utils/withLockedPlayerAndMissionsSafe";
import { TravelTime } from "../../../src/core/maps/TravelTime";

let capturedEndCallback: ((collector: { getFirstReaction: () => unknown }, response: unknown[]) => Promise<void>) | undefined;

vi.mock("../../../src/core/database/game/models/PlayerMessageDelivery", () => ({
	PlayerMessageDeliveries: {
		getOfPlayer: vi.fn(),
		removeOfPlayer: vi.fn()
	}
}));

vi.mock("../../../src/core/maps/Maps", () => ({
	Maps: {
		isOnContinent: vi.fn()
	}
}));

vi.mock("../../../src/core/utils/BlockingUtils", () => ({
	BlockingUtils: {
		blockPlayerUntil: vi.fn(),
		unblockPlayer: vi.fn()
	}
}));

vi.mock("../../../src/core/utils/withLockedPlayerAndMissionsSafe", () => ({
	withLockedPlayerAndMissionsSafe: vi.fn()
}));

vi.mock("../../../src/core/maps/TravelTime", () => ({
	TravelTime: {
		applyEffect: vi.fn()
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

describe("messageRecipient small event", () => {
	const player = {
		id: 1,
		keycloakId: "msg-rec-player",
		getDestinationId: vi.fn().mockReturnValue(30),
		getPreviousMapId: vi.fn().mockReturnValue(10),
		addMoney: vi.fn(),
		addExperience: vi.fn(),
		addHealth: vi.fn(),
		save: vi.fn().mockResolvedValue(undefined)
	} as unknown as Player;

	beforeEach(() => {
		capturedEndCallback = undefined;
		vi.clearAllMocks();
		vi.mocked(Maps.isOnContinent).mockReturnValue(true);
		vi.mocked(withLockedPlayerAndMissionsSafe).mockImplementation(async (_player, _caller, callback) => {
			await callback(player as Player);
		});
	});

	it("checks eligibility: only on continent, having active delivery, at target map", async () => {
		// Not on continent
		vi.mocked(Maps.isOnContinent).mockReturnValue(false);
		expect(await smallEventFuncs.canBeExecuted(player, {} as never)).toBe(false);

		// On continent but no delivery
		vi.mocked(Maps.isOnContinent).mockReturnValue(true);
		vi.mocked(PlayerMessageDeliveries.getOfPlayer).mockResolvedValue(null);
		expect(await smallEventFuncs.canBeExecuted(player, {} as never)).toBe(false);

		// Delivery exists, but not at destination (delivery target 50 != 30, 10)
		vi.mocked(PlayerMessageDeliveries.getOfPlayer).mockResolvedValue({
			playerId: 1,
			destinationLocationId: 50,
			secretEmoji: "apple"
		} as never);
		expect(await smallEventFuncs.canBeExecuted(player, {} as never)).toBe(false);

		// Delivery exists and at destination
		vi.mocked(PlayerMessageDeliveries.getOfPlayer).mockResolvedValue({
			playerId: 1,
			destinationLocationId: 30,
			secretEmoji: "apple"
		} as never);
		expect(await smallEventFuncs.canBeExecuted(player, {} as never)).toBe(true);
	});

	it("handles success when the correct emoji is selected", async () => {
		vi.mocked(PlayerMessageDeliveries.getOfPlayer).mockResolvedValue({
			playerId: 1,
			destinationLocationId: 30,
			secretEmoji: "apple"
		} as never);

		const response: CrowniclesPacket[] = [];
		await smallEventFuncs.executeSmallEvent(response, player, {} as never, {} as never);

		expect(capturedEndCallback).toBeDefined();

		const collectorResponse: CrowniclesPacket[] = [];
		await capturedEndCallback!({
			getFirstReaction: () => ({
				reaction: { data: { emojiId: "apple" } }
			})
		}, collectorResponse);

		expect(PlayerMessageDeliveries.removeOfPlayer).toHaveBeenCalledWith(1);
		expect(player.addMoney).toHaveBeenCalledTimes(1);
		expect(player.addExperience).toHaveBeenCalledTimes(1);
		expect(player.save).toHaveBeenCalled();

		expect(collectorResponse).toHaveLength(1);
		const packet = collectorResponse[0] as SmallEventMessageRecipientPacket;
		expect(packet.outcome).toBe(SmallEventConstants.MESSAGE.OUTCOMES.SUCCESS);
		expect(packet.chosenEmoji).toBe("apple");
		expect(packet.moneyWon).toBeGreaterThan(0);
		expect(packet.xpWon).toBeGreaterThan(0);
	});

	it("handles bomb wrong outcome with health loss", async () => {
		vi.mocked(PlayerMessageDeliveries.getOfPlayer).mockResolvedValue({
			playerId: 1,
			destinationLocationId: 30,
			secretEmoji: "apple"
		} as never);

		const response: CrowniclesPacket[] = [];
		await smallEventFuncs.executeSmallEvent(response, player, {} as never, {} as never);

		const collectorResponse: CrowniclesPacket[] = [];
		await capturedEndCallback!({
			getFirstReaction: () => ({
				reaction: { data: { emojiId: "bomb" } }
			})
		}, collectorResponse);

		expect(PlayerMessageDeliveries.removeOfPlayer).toHaveBeenCalledWith(1);
		expect(player.addHealth).toHaveBeenCalledWith(expect.objectContaining({
			amount: expect.any(Number)
		}));
		const packet = collectorResponse[0] as SmallEventMessageRecipientPacket;
		expect(packet.outcome).toBe(SmallEventConstants.MESSAGE.OUTCOMES.WRONG_BOMB);
		expect(packet.damage).toBeGreaterThan(0);
	});

	it("handles clock wrong outcome with time penalty", async () => {
		vi.mocked(PlayerMessageDeliveries.getOfPlayer).mockResolvedValue({
			playerId: 1,
			destinationLocationId: 30,
			secretEmoji: "apple"
		} as never);

		const response: CrowniclesPacket[] = [];
		await smallEventFuncs.executeSmallEvent(response, player, {} as never, {} as never);

		const collectorResponse: CrowniclesPacket[] = [];
		await capturedEndCallback!({
			getFirstReaction: () => ({
				reaction: { data: { emojiId: "clock" } }
			})
		}, collectorResponse);

		expect(PlayerMessageDeliveries.removeOfPlayer).toHaveBeenCalledWith(1);
		expect(TravelTime.applyEffect).toHaveBeenCalledTimes(1);
		const packet = collectorResponse[0] as SmallEventMessageRecipientPacket;
		expect(packet.outcome).toBe(SmallEventConstants.MESSAGE.OUTCOMES.WRONG_TIME);
		expect(packet.timeLost).toBeGreaterThan(0);
	});

	it("handles timeout when no reaction was received", async () => {
		vi.mocked(PlayerMessageDeliveries.getOfPlayer).mockResolvedValue({
			playerId: 1,
			destinationLocationId: 30,
			secretEmoji: "apple"
		} as never);

		const response: CrowniclesPacket[] = [];
		await smallEventFuncs.executeSmallEvent(response, player, {} as never, {} as never);

		const collectorResponse: CrowniclesPacket[] = [];
		await capturedEndCallback!({
			getFirstReaction: () => undefined
		}, collectorResponse);

		expect(PlayerMessageDeliveries.removeOfPlayer).toHaveBeenCalledWith(1);
		const packet = collectorResponse[0] as SmallEventMessageRecipientPacket;
		expect(packet.outcome).toBe(SmallEventConstants.MESSAGE.OUTCOMES.TIMEOUT);
	});
});
