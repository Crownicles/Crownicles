import {
	afterAll, beforeAll, describe, expect, it
} from "vitest";
import {
	CoreTestEnvironment, loadProductionModule, runAllOrThrow, setupCoreForTests
} from "../_coreSetup";
import {
	DEFAULT_NOTIFICATION_PREFERENCES, NotificationPreferences
} from "../../../Lib/src/types/NotificationPreferences";

type PreferencesModule = typeof import("../../src/core/database/game/models/AppNotificationPreference");

const DISCORD: NotificationPreferences = {
	...DEFAULT_NOTIFICATION_PREFERENCES,
	report: false,
	energy: false
};

/**
 * The app's notification settings start from Discord's, once, and never follow them afterwards (#4738, #4741).
 */
describe("app notification preferences", () => {
	let env: CoreTestEnvironment;
	let preferences: PreferencesModule;

	async function stored(keycloakId: string): Promise<NotificationPreferences> {
		return preferences.preferencesOf((await preferences.AppNotificationPreferences.find(keycloakId))!);
	}

	beforeAll(async () => {
		env = await setupCoreForTests("notif_prefs");
		preferences = loadProductionModule<PreferencesModule>("core/database/game/models/AppNotificationPreference");
	});

	afterAll(async () => {
		await env?.teardown();
	});

	it("creates everything enabled and waits for Discord", async () => {
		const {
			row, created
		} = await preferences.AppNotificationPreferences.getOrCreate("defaults");
		expect(created).toBe(true);
		expect(row.discordPending).toBe(true);
		expect(await stored("defaults")).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
		expect((await preferences.AppNotificationPreferences.getOrCreate("defaults")).created).toBe(false);
	});

	it("takes Discord's settings once, then ignores them", async () => {
		await preferences.AppNotificationPreferences.getOrCreate("seeded");
		expect(await preferences.AppNotificationPreferences.seedFromDiscord("seeded", DISCORD)).toBe(true);
		expect(await stored("seeded")).toEqual(DISCORD);

		expect(await preferences.AppNotificationPreferences.seedFromDiscord("seeded", DEFAULT_NOTIFICATION_PREFERENCES)).toBe(false);
		expect(await stored("seeded")).toEqual(DISCORD);
	});

	it("keeps the defaults when the player has nothing on Discord", async () => {
		await preferences.AppNotificationPreferences.getOrCreate("no-discord");
		expect(await preferences.AppNotificationPreferences.seedFromDiscord("no-discord", undefined)).toBe(true);
		expect(await stored("no-discord")).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
		expect((await preferences.AppNotificationPreferences.find("no-discord"))!.discordPending).toBe(false);
	});

	it("never lets a late Discord answer override a choice made in the app", async () => {
		await preferences.AppNotificationPreferences.getOrCreate("app-first");
		await preferences.AppNotificationPreferences.set("app-first", "dailyBonus", false);
		expect(await preferences.AppNotificationPreferences.seedFromDiscord("app-first", DISCORD)).toBe(false);
		expect(await stored("app-first")).toEqual({
			...DEFAULT_NOTIFICATION_PREFERENCES,
			dailyBonus: false
		});
	});

	it("keeps the app's choice whichever of the two writes lands first", async () => {
		await preferences.AppNotificationPreferences.getOrCreate("race");
		await runAllOrThrow([
			preferences.AppNotificationPreferences.seedFromDiscord("race", DISCORD),
			preferences.AppNotificationPreferences.set("race", "report", true)
		]);
		const result = await stored("race");
		expect(result.report).toBe(true);
		expect((await preferences.AppNotificationPreferences.find("race"))!.discordPending).toBe(false);
	});

	it("creates the row when the app changes a setting before ever reading them", async () => {
		await preferences.AppNotificationPreferences.set("set-first", "tournament", false);
		expect((await stored("set-first")).tournament).toBe(false);
		expect(await preferences.AppNotificationPreferences.seedFromDiscord("set-first", DISCORD)).toBe(false);
	});
});
