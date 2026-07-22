import {
	beforeEach, describe, expect, it, vi
} from "vitest";

vi.mock("../../../src/core/database/game/models/ScheduledReportNotification", () => ({
	ScheduledReportNotifications: {
		getNotificationsBeforeDate: vi.fn(),
		claimNotification: vi.fn()
	}
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

import { processDueReportNotifications } from "../../../src/core/bot/ReportNotifications";
import { ScheduledReportNotifications } from "../../../src/core/database/game/models/ScheduledReportNotification";
import { PacketUtils } from "../../../src/core/utils/PacketUtils";
import { ReachDestinationNotificationPacket } from "../../../../Lib/src/packets/notifications/ReachDestinationNotificationPacket";

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
