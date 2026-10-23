import {
	beforeEach, describe, expect, it, vi
} from "vitest";
import type { Player } from "../../../src/core/database/game/models/Player";
import { smallEventFuncs } from "../../../src/core/smallEvents/message";
import { PlayerMessageDeliveries } from "../../../src/core/database/game/models/PlayerMessageDelivery";
import { MapLocationDataController } from "../../../src/data/MapLocation";
import { Maps } from "../../../src/core/maps/Maps";
import { SmallEventConstants } from "../../../../Lib/src/constants/SmallEventConstants";
import { SmallEventMessagePacket } from "../../../../Lib/src/packets/smallEvents/SmallEventMessagePacket";
import { CrowniclesPacket } from "../../../../Lib/src/packets/CrowniclesPacket";

vi.mock("../../../src/core/database/game/models/PlayerMessageDelivery", () => ({
	PlayerMessageDeliveries: {
		getOfPlayer: vi.fn(),
		createDelivery: vi.fn(),
		removeOfPlayer: vi.fn()
	}
}));

vi.mock("../../../src/core/maps/Maps", () => ({
	Maps: {
		isOnContinent: vi.fn()
	}
}));

vi.mock("../../../src/data/MapLocation", () => ({
	MapLocationDataController: {
		instance: {
			getAll: vi.fn(),
			getRandomGotoableMap: vi.fn()
		}
	}
}));

describe("message small event", () => {
	const player = {
		id: 1,
		keycloakId: "msg-player",
		getDestinationId: vi.fn().mockReturnValue(10),
		getPreviousMapId: vi.fn().mockReturnValue(20)
	} as unknown as Player;

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(Maps.isOnContinent).mockReturnValue(true);
		vi.mocked(MapLocationDataController.instance.getAll).mockReturnValue([
			{ id: 10, canBeGoToPlaceMissionDestination: true } as never,
			{ id: 20, canBeGoToPlaceMissionDestination: true } as never,
			{ id: 30, canBeGoToPlaceMissionDestination: true } as never
		]);
		vi.mocked(MapLocationDataController.instance.getRandomGotoableMap).mockReturnValue({ id: 30 } as never);
	});

	it("checks eligibility based on isOnContinent", async () => {
		vi.mocked(Maps.isOnContinent).mockReturnValue(true);
		expect(await smallEventFuncs.canBeExecuted(player, {} as never)).toBe(true);

		vi.mocked(Maps.isOnContinent).mockReturnValue(false);
		expect(await smallEventFuncs.canBeExecuted(player, {} as never)).toBe(false);
	});

	it("creates a new delivery if player does not have one", async () => {
		vi.mocked(PlayerMessageDeliveries.getOfPlayer).mockResolvedValue(null);

		const response: CrowniclesPacket[] = [];
		await smallEventFuncs.executeSmallEvent(response, player, {} as never, {} as never);

		expect(PlayerMessageDeliveries.createDelivery).toHaveBeenCalledTimes(1);
		expect(PlayerMessageDeliveries.createDelivery).toHaveBeenCalledWith(
			1,
			30,
			expect.any(String)
		);

		expect(response).toHaveLength(1);
		const packet = response[0] as SmallEventMessagePacket;
		expect(packet).toBeInstanceOf(SmallEventMessagePacket);
		expect(packet.interactionName).toBe(SmallEventConstants.MESSAGE.INTERACTIONS.INTRO);
		expect(packet.destinationLocationId).toBe(30);
		expect(packet.secretEmoji).toBeDefined();
		expect(packet.vanishAfterMs).toBe(SmallEventConstants.MESSAGE.VANISH_TIME_MS);
	});

	it("returns alreadyActive interaction if player already has an ongoing delivery", async () => {
		vi.mocked(PlayerMessageDeliveries.getOfPlayer).mockResolvedValue({
			playerId: 1,
			destinationLocationId: 30,
			secretEmoji: "apple"
		} as never);

		const response: CrowniclesPacket[] = [];
		await smallEventFuncs.executeSmallEvent(response, player, {} as never, {} as never);

		expect(PlayerMessageDeliveries.createDelivery).not.toHaveBeenCalled();
		expect(response).toHaveLength(1);
		const packet = response[0] as SmallEventMessagePacket;
		expect(packet).toBeInstanceOf(SmallEventMessagePacket);
		expect(packet.interactionName).toBe(SmallEventConstants.MESSAGE.INTERACTIONS.ALREADY_ACTIVE);
		expect(packet.destinationLocationId).toBe(30);
	});
});
