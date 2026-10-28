import {
	beforeEach, describe, expect, it, vi
} from "vitest";

vi.mock("../../../src/bot/CrowniclesShard", () => ({
	keycloakConfig: {},
	shardId: 0
}));
vi.mock("../../../src/bot/DiscordCache");
vi.mock("../../../src/utils/PacketUtils", () => ({
	PacketUtils: { sendPacketToBackend: vi.fn() }
}));
vi.mock("../../../src/utils/DisplayUtils", () => ({
	DisplayUtils: { getEscapedUsername: vi.fn().mockResolvedValue("Tester") }
}));
vi.mock("../../../../Lib/src/logs/CrowniclesLogger", () => ({
	CrowniclesLogger: { warn: vi.fn() }
}));

import {
	DiscordAPIError, ReactionCollector, RESTJSONErrorCodes
} from "discord.js";
import { DiscordCache } from "../../../src/bot/DiscordCache";
import { PacketUtils } from "../../../src/utils/PacketUtils";
import { reportTravelSummary } from "../../../src/commands/player/report/travel/TravelSummary";
import {
	CommandReportTravelSummaryRes, CommandReportUseTokensPacketReq
} from "../../../../Lib/src/packets/commands/CommandReportPacket";
import { PacketContext } from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	fakeCollectorMessage, wait
} from "../../bot/fakeCollectorMessage";

const USER_ID = "user";

const user = {
	id: USER_ID,
	displayName: "Tester",
	displayAvatarURL: (): string => "https://example.com/avatar.png"
};

const context = {
	discord: {
		interaction: "report-interaction",
		language: "fr",
		user: USER_ID
	},
	keycloakId: "keycloak"
} as PacketContext;

function travelSummaryWithTokens(): CommandReportTravelSummaryRes {
	const now = Date.now();
	return {
		startMap: {
			id: 1, type: "ci"
		},
		endMap: {
			id: 2, type: "ci"
		},
		startTime: now - 60_000,
		arriveTime: now + 60_000,
		nextStopTime: now + 30_000,
		isOnBoat: false,
		points: {
			show: false, cumulated: 0
		},
		energy: {
			show: false, current: 0, max: 0
		},
		tokens: {
			cost: 1, canAfford: true
		},
		isInCity: false
	} as CommandReportTravelSummaryRes;
}

function unknownInteractionError(): DiscordAPIError {
	return new DiscordAPIError(
		{
			message: "Unknown interaction",
			code: RESTJSONErrorCodes.UnknownInteraction
		},
		RESTJSONErrorCodes.UnknownInteraction,
		404,
		"POST",
		"https://discord.com/api/v10/interactions/id/token/callback",
		{}
	);
}

describe("reportTravelSummary", () => {
	beforeEach(() => {
		vi.mocked(PacketUtils.sendPacketToBackend).mockClear();
	});

	it("still asks Core to use the tokens when the click expired before being acknowledged (#5059)", async () => {
		const collectors: ReactionCollector[] = [];
		vi.mocked(DiscordCache.getInteraction).mockReturnValue({
			userLanguage: "fr",
			user,
			editReply: (): Promise<unknown> => Promise.resolve(fakeCollectorMessage(collectors))
		} as never);
		await reportTravelSummary(travelSummaryWithTokens(), context);
		expect(collectors).toHaveLength(1);

		const expiredClick = {
			user,
			customId: "useTokens",
			createdTimestamp: Date.now() - 4000,
			update: (): Promise<void> => Promise.reject(unknownInteractionError()),
			followUp: (): Promise<void> => Promise.reject(new Error("The reply to this interaction has not been sent or deferred.")),
			message: { edit: vi.fn().mockResolvedValue(undefined) }
		};
		collectors[0].emit("collect", expiredClick, user);
		await wait(0);

		expect(expiredClick.message.edit).toHaveBeenCalled();
		expect(PacketUtils.sendPacketToBackend).toHaveBeenCalledOnce();
		const [sentContext, sentPacket] = vi.mocked(PacketUtils.sendPacketToBackend).mock.calls[0];
		expect(sentContext).toBe(context);
		expect(sentPacket).toBeInstanceOf(CommandReportUseTokensPacketReq);
		expect(collectors[0].ended).toBe(true);
	});
});
