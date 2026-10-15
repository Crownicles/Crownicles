import {
	afterEach, beforeEach, describe, expect, it, vi
} from "vitest";
import { makePacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { ReachDestinationNotificationPacket } from "../../../../Lib/src/packets/notifications/ReachDestinationNotificationPacket";
import { EnergyFullNotificationPacket } from "../../../../Lib/src/packets/notifications/EnergyFullNotificationPacket";
import { GDPRExportCompleteNotificationPacket } from "../../../../Lib/src/packets/notifications/GDPRExportCompleteNotificationPacket";
import { AppNotificationsSerializedPacket } from "../../../../Lib/src/packets/notifications/AppNotificationsSerializedPacket";
import {
	DEFAULT_NOTIFICATION_PREFERENCES, NOTIFICATION_TYPES
} from "../../../../Lib/src/types/NotificationPreferences";
import { AppNotificationPreference } from "../../../src/core/database/game/models/AppNotificationPreference";
import { AppPushDevice } from "../../../src/core/database/game/models/AppPushDevice";
import { publishAppNotifications } from "../../../src/core/bot/AppNotifications";
import { mqttClient } from "../../../src/mqttClient";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";

const APP_PLAYER = "app-player";
const QUIET_PLAYER = "quiet-player";
const DISCORD_ONLY = "discord-only";

const IPHONE = {
	keycloakId: APP_PLAYER,
	token: "a".repeat(64),
	platform: "ios",
	sandbox: true,
	language: "fr"
};

function arrival(keycloakId: string): ReachDestinationNotificationPacket {
	return makePacket(ReachDestinationNotificationPacket, {
		keycloakId,
		mapType: "be",
		mapId: 1
	});
}

function published(publish: ReturnType<typeof vi.spyOn>): AppNotificationsSerializedPacket {
	return JSON.parse(publish.mock.calls[0][1] as string) as AppNotificationsSerializedPacket;
}

describe("notifications for the app", () => {
	let publish: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		vi.spyOn(CrowniclesLogger, "debug")
			.mockImplementation(() => {});
		publish = vi.spyOn(mqttClient, "publish")
			.mockImplementation(() => mqttClient);
		vi.spyOn(AppNotificationPreference, "findAll")
			.mockResolvedValue([
				{
					keycloakId: APP_PLAYER, ...DEFAULT_NOTIFICATION_PREFERENCES
				},
				{
					keycloakId: QUIET_PLAYER, ...DEFAULT_NOTIFICATION_PREFERENCES, report: false
				}
			] as AppNotificationPreference[]);
		vi.spyOn(AppPushDevice, "findAll")
			.mockResolvedValue([IPHONE] as AppPushDevice[]);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("hands RestWs what each app player wants, with their devices, at least once and never replayed", async () => {
		await publishAppNotifications([arrival(APP_PLAYER)]);

		expect(publish).toHaveBeenCalledOnce();
		expect(publish.mock.calls[0][0]).toMatch(/crownicles_app_notifications$/u);
		expect(publish.mock.calls[0][2]).toEqual({ qos: 1 });
		expect(published(publish).deliveries).toEqual([
			{
				notificationType: NOTIFICATION_TYPES.REPORT,
				notification: {
					type: "ReachDestinationNotificationPacket",
					packet: arrival(APP_PLAYER)
				},
				devices: [
					{
						token: IPHONE.token, platform: "ios", sandbox: true, language: "fr"
					}
				]
			}
		]);
	});

	it("leaves out a kind the player turned off, and players who never opened the app", async () => {
		await publishAppNotifications([
			arrival(QUIET_PLAYER),
			arrival(DISCORD_ONLY),
			makePacket(EnergyFullNotificationPacket, { keycloakId: QUIET_PLAYER })
		]);

		expect(published(publish).deliveries.map(delivery => [delivery.notification.packet.keycloakId, delivery.notificationType]))
			.toEqual([[QUIET_PLAYER, NOTIFICATION_TYPES.ENERGY]]);
	});

	it("still delivers to a player without devices, for the app open on screen", async () => {
		vi.mocked(AppPushDevice.findAll).mockResolvedValue([]);
		await publishAppNotifications([arrival(APP_PLAYER)]);

		expect(published(publish).deliveries[0].devices).toEqual([]);
	});

	it("keeps what only Discord can show, such as a GDPR export, off the app", async () => {
		await publishAppNotifications([
			makePacket(GDPRExportCompleteNotificationPacket, {
				keycloakId: APP_PLAYER, csvFiles: {}, anonymizedPlayerId: "x", exportedPlayerKeycloakId: APP_PLAYER
			})
		]);

		expect(publish).not.toHaveBeenCalled();
	});
});
