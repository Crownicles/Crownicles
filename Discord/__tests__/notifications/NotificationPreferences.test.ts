import {
	describe, expect, it
} from "vitest";
import NotificationsConfiguration from "../../src/database/discord/models/NotificationsConfiguration";
import { discordPreferences } from "../../src/notifications/NotificationType";
import { ALL_NOTIFICATION_TYPES } from "../../../Lib/src/types/NotificationPreferences";

function configuration(disabled: string[]): NotificationsConfiguration {
	return Object.fromEntries(ALL_NOTIFICATION_TYPES.map(type => [`${type}Enabled`, !disabled.includes(type)])) as unknown as NotificationsConfiguration;
}

describe("Discord notification settings shared with the app", () => {
	it("gives the on/off state of every kind the app knows", () => {
		expect(Object.keys(discordPreferences(configuration([]))).sort()).toEqual([...ALL_NOTIFICATION_TYPES].sort());
	});

	it("keeps the kinds the player turned off on Discord", () => {
		const preferences = discordPreferences(configuration(["report", "tournament"]));
		expect(preferences.report).toBe(false);
		expect(preferences.tournament).toBe(false);
		expect(preferences.energy).toBe(true);
	});
});
