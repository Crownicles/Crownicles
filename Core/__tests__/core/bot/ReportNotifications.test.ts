import {
	beforeEach, describe, expect, it, vi
} from "vitest";

vi.mock("../../../src/core/database/game/models/ScheduledReportNotification", () => ({
	ScheduledReportNotifications: {
		getNotificationsBeforeDate: vi.fn(),
		claimNotification: vi.fn(),
		rescheduleNotification: vi.fn(),
		getPendingNotification: vi.fn()
	}
}));

vi.mock("../../../src/core/maps/TravelTime", () => ({
	TravelTime: { getTravelDataSimplified: vi.fn() }
}));

vi.mock("../../../src/core/utils/PacketUtils", () => ({
	PacketUtils: {
		sendNotifications: vi.fn()
	}
}));

vi.mock("../../../src/data/MapLocation", () => ({
	MapLocationDataController: {
		instance: {
			getById: vi.fn(() => ({ type: 0 }))
		}
	}
}));

import {
	dispatchOrRescheduleArrivalNotification, processDueReportNotifications
} from "../../../src/core/bot/ReportNotifications";
import { ScheduledReportNotifications } from "../../../src/core/database/game/models/ScheduledReportNotification";
import { TravelTime } from "../../../src/core/maps/TravelTime";
import { PacketUtils } from "../../../src/core/utils/PacketUtils";
import { ReachDestinationNotificationPacket } from "../../../../Lib/src/packets/notifications/ReachDestinationNotificationPacket";
import type Player from "../../../src/core/database/game/models/Player";
import { asMilliseconds } from "../../../../Lib/src/utils/TimeUtils";

describe("processDueReportNotifications", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("sends a claimed arrival notification exactly once", async () => {
		vi.mocked(ScheduledReportNotifications.getNotificationsBeforeDate).mockResolvedValue([
			{
				playerId: 1, keycloakId: "player", mapId: 42
			}
		] as never);
		vi.mocked(ScheduledReportNotifications.claimNotification).mockResolvedValue(true);

		await processDueReportNotifications();

		expect(ScheduledReportNotifications.claimNotification).toHaveBeenCalledWith(1);
		expect(PacketUtils.sendNotifications).toHaveBeenCalledOnce();
		const packets = vi.mocked(PacketUtils.sendNotifications).mock.calls[0][0];
		expect(packets).toHaveLength(1);
		expect(packets[0]).toBeInstanceOf(ReachDestinationNotificationPacket);
		expect(packets[0]).toMatchObject({
			keycloakId: "player", mapId: 42
		});
	});

	it("does not send a notification already claimed by the afterSave hook", async () => {
		vi.mocked(ScheduledReportNotifications.getNotificationsBeforeDate).mockResolvedValue([
			{
				playerId: 1, keycloakId: "player", mapId: 42
			}
		] as never);
		vi.mocked(ScheduledReportNotifications.claimNotification).mockResolvedValue(false);

		await processDueReportNotifications();

		expect(ScheduledReportNotifications.claimNotification).toHaveBeenCalledWith(1);
		expect(PacketUtils.sendNotifications).not.toHaveBeenCalled();
	});
});

describe("dispatchOrRescheduleArrivalNotification", () => {
	const now = Date.now();

	/**
	 * `dispatchOrRescheduleArrivalNotification` only reads the id and the destination of the player, and a full
	 * Sequelize model instance cannot be built here: the cast keeps the fixture in a single place.
	 */
	function travellingPlayer(destinationId: number): Player {
		return {
			id: 1,
			getDestinationId: (): number => destinationId
		} as Player;
	}

	function travelEndingAt(travelEndTime: number): ReturnType<typeof TravelTime.getTravelDataSimplified> {
		return {
			travelStartTime: asMilliseconds(0),
			travelEndTime: asMilliseconds(travelEndTime),
			effectStartTime: asMilliseconds(0),
			effectEndTime: asMilliseconds(0),
			effectDuration: asMilliseconds(0),
			effectRemainingTime: asMilliseconds(0),
			playerTravelledTime: asMilliseconds(0)
		};
	}

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("never resurrects a notification for a travel that is already over", async () => {
		// The arrival big event granted an alteration, pushing the travel end back into the future
		vi.mocked(TravelTime.getTravelDataSimplified).mockReturnValue(travelEndingAt(now + 3_600_000));

		await dispatchOrRescheduleArrivalNotification(travellingPlayer(42));

		expect(ScheduledReportNotifications.rescheduleNotification).toHaveBeenCalledWith(1, 42, new Date(now + 3_600_000));
		expect(PacketUtils.sendNotifications).not.toHaveBeenCalled();
	});

	it("stays silent when the player has no pending notification left", async () => {
		vi.mocked(TravelTime.getTravelDataSimplified).mockReturnValue(travelEndingAt(now - 1_000));
		vi.mocked(ScheduledReportNotifications.getPendingNotification).mockResolvedValue(null);

		await dispatchOrRescheduleArrivalNotification(travellingPlayer(42));

		expect(ScheduledReportNotifications.claimNotification).not.toHaveBeenCalled();
		expect(PacketUtils.sendNotifications).not.toHaveBeenCalled();
	});

	it("dispatches the arrival notification it claimed", async () => {
		vi.mocked(TravelTime.getTravelDataSimplified).mockReturnValue(travelEndingAt(now - 1_000));
		vi.mocked(ScheduledReportNotifications.getPendingNotification).mockResolvedValue({
			playerId: 1, keycloakId: "player", mapId: 42
		});
		vi.mocked(ScheduledReportNotifications.claimNotification).mockResolvedValue(true);

		await dispatchOrRescheduleArrivalNotification(travellingPlayer(42));

		expect(PacketUtils.sendNotifications).toHaveBeenCalledOnce();
	});

	it("never dispatches a notification scheduled for another destination", async () => {
		vi.mocked(TravelTime.getTravelDataSimplified).mockReturnValue(travelEndingAt(now - 1_000));
		vi.mocked(ScheduledReportNotifications.getPendingNotification).mockResolvedValue({
			playerId: 1, keycloakId: "player", mapId: 42
		});
		vi.mocked(ScheduledReportNotifications.claimNotification).mockResolvedValue(true);

		await dispatchOrRescheduleArrivalNotification(travellingPlayer(43));

		expect(PacketUtils.sendNotifications).not.toHaveBeenCalled();
	});
});
