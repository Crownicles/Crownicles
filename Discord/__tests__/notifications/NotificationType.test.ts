import {
	describe, expect, it
} from "vitest";
import NotificationsConfiguration from "../../src/database/discord/models/NotificationsConfiguration";
import {
	NotificationsTypes
} from "../../src/notifications/NotificationType";
import { NotificationSendTypeEnum } from "../../src/notifications/NotificationSendType";

describe("Tournament notification preferences", () => {
	it("is enabled by default in the notification type registry", () => {
		const configuration = {
			tournamentEnabled: true,
			tournamentSendType: NotificationSendTypeEnum.DM,
			tournamentChannelId: undefined
		} as NotificationsConfiguration;

		expect(NotificationsTypes.ALL).toContain(NotificationsTypes.TOURNAMENT);
		expect(NotificationsTypes.TOURNAMENT.value(configuration)).toMatchObject({
			enabled: true,
			sendType: NotificationSendTypeEnum.DM
		});
	});

	it("toggles and changes the tournament delivery mode", () => {
		const configuration = {
			tournamentEnabled: true,
			tournamentSendType: NotificationSendTypeEnum.DM,
			tournamentChannelId: undefined
		} as NotificationsConfiguration;

		NotificationsTypes.TOURNAMENT.toggleCallback(configuration);
		NotificationsTypes.TOURNAMENT.changeSendTypeCallback(configuration, NotificationSendTypeEnum.CHANNEL, "channel-id");

		expect(configuration.tournamentEnabled).toBe(false);
		expect(configuration.tournamentSendType).toBe(NotificationSendTypeEnum.CHANNEL);
		expect(configuration.tournamentChannelId).toBe("channel-id");
	});
});