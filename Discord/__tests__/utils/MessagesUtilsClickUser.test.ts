import {
	describe, expect, it
} from "vitest";
import {
	ButtonInteraction, User
} from "discord.js";
import { DiscordCache } from "../../src/bot/DiscordCache";
import { MessagesUtils } from "../../src/utils/MessagesUtils";
import { PacketContext } from "../../../Lib/src/packets/CrowniclesPacket";

function contextOf(click: Partial<NonNullable<PacketContext["discord"]>>): PacketContext {
	return {
		discord: {
			interaction: "command-id",
			user: "command-author",
			channel: "channel",
			language: "fr",
			...click
		}
	} as PacketContext;
}

describe("MessagesUtils.getClickUser", () => {
	it("returns the author of an answerable button click", () => {
		const clicker = { id: "buyer" } as User;
		DiscordCache.cacheButtonInteraction({
			id: "answerable-click", user: clicker
		} as ButtonInteraction);

		expect(MessagesUtils.getClickUser(contextOf({ buttonInteraction: "answerable-click" }))).toBe(clicker);
	});

	it("still returns the author of a selection whose acknowledgement failed (#5059)", () => {
		const clicker = { id: "selector" } as User;
		DiscordCache.cacheUnanswerableClickUser("expired-selection", clicker);

		expect(MessagesUtils.getClickUser(contextOf({ stringSelectMenuInteraction: "expired-selection" }))).toBe(clicker);
	});

	it("returns nothing when Core responds without any click", () => {
		expect(MessagesUtils.getClickUser(contextOf({}))).toBeNull();
	});
});
