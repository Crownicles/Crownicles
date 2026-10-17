import {
	afterEach, beforeEach, describe, expect, it, vi
} from "vitest";

vi.mock("../../../src/core/database/game/models/ScheduledExpeditionNotification", () => ({
	ScheduledExpeditionNotifications: {
		bulkDelete: vi.fn(),
		getNotificationsBeforeDate: vi.fn()
	}
}));

vi.mock("../../../src/core/utils/PacketUtils", () => ({
	PacketUtils: {
		isMqttConnected: vi.fn(),
		sendNotifications: vi.fn()
	}
}));

import { processDueExpeditionNotifications } from "../../../src/core/bot/ExpeditionNotifications";
import { ScheduledExpeditionNotifications } from "../../../src/core/database/game/models/ScheduledExpeditionNotification";
import { PacketUtils } from "../../../src/core/utils/PacketUtils";
import { ExpeditionFinishedNotificationPacket } from "../../../../Lib/src/packets/notifications/ExpeditionFinishedNotificationPacket";

describe("processDueExpeditionNotifications", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.clearAllTimers();
		vi.useRealTimers();
	});

	it("sends and removes due expedition notifications", async () => {
		const notifications = [{
			expeditionId: 12,
			keycloakId: "player",
			petId: 100,
			petNickname: "Spectre",
			petSex: "m"
		}];
		vi.mocked(PacketUtils.isMqttConnected).mockReturnValue(true);
		vi.mocked(ScheduledExpeditionNotifications.getNotificationsBeforeDate).mockResolvedValue(notifications as never);

		await processDueExpeditionNotifications();

		expect(PacketUtils.sendNotifications).toHaveBeenCalledOnce();
		const packets = vi.mocked(PacketUtils.sendNotifications).mock.calls[0][0];
		expect(packets).toHaveLength(1);
		expect(packets[0]).toBeInstanceOf(ExpeditionFinishedNotificationPacket);
		expect(packets[0]).toMatchObject({
			keycloakId: "player",
			petId: 100,
			petNickname: "Spectre",
			petSex: "m"
		});
		expect(ScheduledExpeditionNotifications.bulkDelete).toHaveBeenCalledWith(notifications);
	});
});