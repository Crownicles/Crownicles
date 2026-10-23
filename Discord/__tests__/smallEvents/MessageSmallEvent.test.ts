import {
	afterEach, beforeEach, describe, expect, it, vi
} from "vitest";
import { DiscordCache } from "../../src/bot/DiscordCache";
import { messageHandler } from "../../src/smallEvents/message";
import { messageRecipientResult } from "../../src/smallEvents/messageRecipient";
import { SmallEventConstants } from "../../../Lib/src/constants/SmallEventConstants";

vi.mock("../../src/bot/DiscordCache");

describe("Discord message small event", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("edits reply with alreadyActive text when already active", async () => {
		const editReply = vi.fn().mockResolvedValue({ id: "msg-1" });
		vi.mocked(DiscordCache.getInteraction).mockReturnValue({
			editReply,
			userLanguage: "fr",
			user: {
				displayAvatarURL: () => "https://example.com/avatar.png",
				displayName: "Tester"
			}
		} as never);

		await messageHandler({
			discord: {
				interaction: "interaction-id"
			}
		} as never, {
			interactionName: SmallEventConstants.MESSAGE.INTERACTIONS.ALREADY_ACTIVE,
			destinationLocationId: 1
		} as never);

		expect(editReply).toHaveBeenCalledTimes(1);
	});

	it("edits reply with secret emoji and edits again after vanish timer", async () => {
		const editReply = vi.fn().mockResolvedValue({ id: "msg-1" });
		vi.mocked(DiscordCache.getInteraction).mockReturnValue({
			editReply,
			userLanguage: "fr",
			user: {
				displayAvatarURL: () => "https://example.com/avatar.png",
				displayName: "Tester"
			}
		} as never);

		await messageHandler({
			discord: {
				interaction: "interaction-id"
			}
		} as never, {
			interactionName: SmallEventConstants.MESSAGE.INTERACTIONS.INTRO,
			destinationLocationId: 1,
			secretEmoji: "apple",
			vanishAfterMs: 30000
		} as never);

		expect(editReply).toHaveBeenCalledTimes(1);

		// Fast-forward 30 seconds
		await vi.advanceTimersByTimeAsync(30000);

		expect(editReply).toHaveBeenCalledTimes(2);
	});

	it("messageRecipientResult sends followUp embed with outcome", async () => {
		const followUp = vi.fn().mockResolvedValue({ id: "msg-followup" });
		vi.mocked(DiscordCache.getInteraction).mockReturnValue({
			followUp,
			userLanguage: "fr",
			user: {
				displayAvatarURL: () => "https://example.com/avatar.png",
				displayName: "Tester"
			}
		} as never);

		await messageRecipientResult({
			discord: {
				interaction: "interaction-id"
			}
		} as never, {
			outcome: SmallEventConstants.MESSAGE.OUTCOMES.SUCCESS,
			chosenEmoji: "apple",
			correctEmoji: "apple",
			destinationLocationId: 1,
			moneyWon: 100,
			xpWon: 30
		} as never);

		expect(followUp).toHaveBeenCalledTimes(1);
	});
});
