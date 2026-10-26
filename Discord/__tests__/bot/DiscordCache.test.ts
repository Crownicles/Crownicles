import {
	describe, expect, it
} from "vitest";
import {
	ButtonInteraction, StringSelectMenuInteraction
} from "discord.js";
import { DiscordCache } from "../../src/bot/DiscordCache";
import { CrowniclesInteraction } from "../../src/messages/CrowniclesInteraction";
import { Constants } from "../../../Lib/src/constants/Constants";
import { DISCORD_MONITORED_CACHES } from "../../src/bot/CrowniclesDiscordMetrics";
import { getExposedCacheSize } from "./cacheSizes";

function fakeInteraction<T>(id: string): T {
	return { id } as T;
}

describe("DiscordCache", () => {
	it("purges the expired entries of every interaction cache, not only the command interactions", async () => {
		const cachedAt = Date.now();
		DiscordCache.cacheInteraction(fakeInteraction<CrowniclesInteraction>("command"));
		DiscordCache.cacheButtonInteraction(fakeInteraction<ButtonInteraction>("button"));
		DiscordCache.cacheStringSelectMenuInteraction(fakeInteraction<StringSelectMenuInteraction>("select"));

		DiscordCache.purge(cachedAt);
		expect(DiscordCache.getInteraction("command")?.id).toBe("command");
		expect(DiscordCache.getButtonInteraction("button")?.id).toBe("button");
		expect(DiscordCache.getStringSelectMenuInteraction("select")?.id).toBe("select");

		DiscordCache.purge(Date.now() + Constants.CACHE_TIME.INTERACTIONS + 1);
		expect(DiscordCache.getInteraction("command")).toBeNull();
		expect(DiscordCache.getButtonInteraction("button")).toBeNull();
		expect(DiscordCache.getStringSelectMenuInteraction("select")).toBeNull();
		expect(await getExposedCacheSize(DISCORD_MONITORED_CACHES.INTERACTIONS)).toBe(0);
		expect(await getExposedCacheSize(DISCORD_MONITORED_CACHES.BUTTON_INTERACTIONS)).toBe(0);
		expect(await getExposedCacheSize(DISCORD_MONITORED_CACHES.STRING_SELECT_MENU_INTERACTIONS)).toBe(0);
	});

	it("exposes the size of each interaction cache to Prometheus", async () => {
		DiscordCache.cacheButtonInteraction(fakeInteraction<ButtonInteraction>("button-1"));
		DiscordCache.cacheButtonInteraction(fakeInteraction<ButtonInteraction>("button-2"));

		expect(await getExposedCacheSize(DISCORD_MONITORED_CACHES.BUTTON_INTERACTIONS)).toBe(2);

		DiscordCache.purge(Date.now() + Constants.CACHE_TIME.INTERACTIONS + 1);
	});
});
