import {
	beforeEach, describe, expect, it, vi
} from "vitest";

vi.mock("../../../src/bot/DiscordCache", () => ({
	DiscordCache: {
		getInteraction: vi.fn(),
		getButtonInteraction: vi.fn()
	}
}));

import { DiscordCache } from "../../../src/bot/DiscordCache";
import {
	handleUseTokensAccept, handleUseTokensRefuse
} from "../../../src/commands/player/report/useTokens/UseTokensHandlers";
import { CommandReportUseTokensAcceptPacketRes } from "../../../../Lib/src/packets/commands/CommandReportPacket";
import { PacketContext } from "../../../../Lib/src/packets/CrowniclesPacket";

const user = {
	id: "user",
	displayName: "Tester",
	displayAvatarURL: (): string => "https://example.com/avatar.png"
};

const acceptPacket = {
	tokensSpent: 1,
	isArrived: false
} as CommandReportUseTokensAcceptPacketRes;

function contextAfterClick(buttonInteraction?: string): PacketContext {
	return {
		keycloakId: "keycloak",
		discord: {
			user: "user",
			channel: "channel",
			interaction: "report-interaction",
			language: "fr",
			shardId: 0,
			...buttonInteraction ? { buttonInteraction } : {}
		}
	} as PacketContext;
}

describe("use tokens response (#5059)", () => {
	const commandInteraction = {
		userLanguage: "fr",
		user,
		followUp: vi.fn()
	};

	beforeEach(() => {
		commandInteraction.followUp.mockReset();
		vi.mocked(DiscordCache.getInteraction).mockReturnValue(commandInteraction as never);
		vi.mocked(DiscordCache.getButtonInteraction).mockReset();
	});

	it("displays the spent tokens as a follow-up of the command when the click could not be acknowledged", async () => {
		vi.mocked(DiscordCache.getButtonInteraction).mockReturnValue(null);

		await handleUseTokensAccept(acceptPacket, contextAfterClick("expired-click"));

		expect(commandInteraction.followUp).toHaveBeenCalledOnce();
		expect(commandInteraction.followUp.mock.calls[0][0]).toHaveProperty("embeds");
	});

	it("displays the spent tokens in the reply deferred on the click when it was acknowledged", async () => {
		const click = { editReply: vi.fn() };
		vi.mocked(DiscordCache.getButtonInteraction).mockReturnValue(click as never);

		await handleUseTokensAccept(acceptPacket, contextAfterClick("acknowledged-click"));

		expect(click.editReply).toHaveBeenCalledOnce();
		expect(commandInteraction.followUp).not.toHaveBeenCalled();
	});

	it("displays nothing when the confirmation ended without any click", async () => {
		await handleUseTokensRefuse(contextAfterClick());

		expect(commandInteraction.followUp).not.toHaveBeenCalled();
	});
});
