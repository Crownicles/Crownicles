import {
	describe, expect, it, vi
} from "vitest";
import { DiscordCache } from "../../src/bot/DiscordCache";
import { cartResult } from "../../src/smallEvents/cart";

vi.mock("../../src/bot/DiscordCache");

describe("cartResult timeout", () => {
	it("edits the original interaction when no button was pressed", async () => {
		const editReply = vi.fn().mockResolvedValue(undefined);
		vi.mocked(DiscordCache.getInteraction).mockReturnValue({
			editReply,
			user: {
				displayAvatarURL: () => "https://example.com/avatar.png",
				displayName: "Tester"
			}
		} as never);

		await cartResult({
			isDisplayed: true,
			isScam: false,
			pointsWon: 0,
			travelDone: {
				hasEnoughMoney: true,
				isAccepted: false
			}
		} as never, {
			discord: {
				channel: "channel",
				interaction: "command-interaction",
				language: "fr",
				shardId: 0,
				user: "user"
			},
			frontEndOrigin: "discord",
			frontEndSubOrigin: "guild"
		} as never);

		expect(DiscordCache.getInteraction).toHaveBeenCalledWith("command-interaction");
		expect(editReply).toHaveBeenCalledOnce();
	});
});