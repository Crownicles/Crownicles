import {
	afterEach, beforeAll, describe, expect, it, vi
} from "vitest";

vi.mock("../../src/bot/CrowniclesShard", async () => (await import("../mocks/DiscordRenderMocks")).shardMock);
vi.mock("../../../Lib/src/keycloak/KeycloakUtils", async () => (await import("../mocks/DiscordRenderMocks")).keycloakUtilsMock);
vi.mock("../../../Lib/src/logs/CrowniclesLogger", async () => (await import("../mocks/DiscordRenderMocks")).loggerMock);
vi.mock("../../src/utils/PacketUtils", () => ({
	PacketUtils: { sendPacketToBackend: vi.fn() }
}));

import "../../src/packetHandlers/handlers/smallEvents/advanceTime";
import "../../src/packetHandlers/handlers/smallEvents/boatAdvice";
import "../../src/packetHandlers/handlers/smallEvents/doNothing";
import "../../src/packetHandlers/handlers/smallEvents/farmer";
import "../../src/packetHandlers/handlers/smallEvents/findItem";
import "../../src/packetHandlers/handlers/smallEvents/findPotion";
import "../../src/packetHandlers/handlers/smallEvents/haunted";
import "../../src/packetHandlers/handlers/smallEvents/smallBad";
import "../../src/packetHandlers/handlers/smallEvents/staffMember";
import "../../src/packetHandlers/handlers/smallEvents/ultimateFoodMerchant";
import "../../src/packetHandlers/handlers/smallEvents/winEnergy";
import "../../src/packetHandlers/handlers/smallEvents/winEnergyOnIsland";
import "../../src/packetHandlers/handlers/smallEvents/winGuildXP";
import "../../src/packetHandlers/handlers/smallEvents/winHealth";
import "../../src/packetHandlers/handlers/smallEvents/winPersonalXP";
import {
	CrowniclesPacket, makePacket
} from "../../../Lib/src/packets/CrowniclesPacket";
import { SmallEventAdvanceTimePacket } from "../../../Lib/src/packets/smallEvents/SmallEventAdvanceTimePacket";
import { SmallEventBoatAdvicePacket } from "../../../Lib/src/packets/smallEvents/SmallEventBoatAdvicePacket";
import { SmallEventDoNothingPacket } from "../../../Lib/src/packets/smallEvents/SmallEventDoNothingPacket";
import { SmallEventFarmerPacket } from "../../../Lib/src/packets/smallEvents/SmallEventFarmerPacket";
import { SmallEventFindItemPacket } from "../../../Lib/src/packets/smallEvents/SmallEventFindItemPacket";
import { SmallEventFindPotionPacket } from "../../../Lib/src/packets/smallEvents/SmallEventFindPotionPacket";
import { SmallEventHauntedPacket } from "../../../Lib/src/packets/smallEvents/SmallEventHauntedPacket";
import {
	SmallEventBadIssue, SmallEventSmallBadPacket
} from "../../../Lib/src/packets/smallEvents/SmallEventSmallBadPacket";
import { SmallEventStaffMemberPacket } from "../../../Lib/src/packets/smallEvents/SmallEventStaffMemberPacket";
import { SmallEventUltimateFoodMerchantPacket } from "../../../Lib/src/packets/smallEvents/SmallEventUltimateFoodMerchantPacket";
import { SmallEventWinEnergyPacket } from "../../../Lib/src/packets/smallEvents/SmallEventWinEnergyPacket";
import { SmallEventWinEnergyOnIslandPacket } from "../../../Lib/src/packets/smallEvents/SmallEventWinEnergyOnIslandPacket";
import { SmallEventWinGuildXPPacket } from "../../../Lib/src/packets/smallEvents/SmallEventWinGuildXPPacket";
import { SmallEventWinHealthPacket } from "../../../Lib/src/packets/smallEvents/SmallEventWinHealthPacket";
import { SmallEventWinPersonalXPPacket } from "../../../Lib/src/packets/smallEvents/SmallEventWinPersonalXPPacket";
import { CrowniclesIcons } from "../../../Lib/src/CrowniclesIcons";
import { Effect } from "../../../Lib/src/types/Effect";
import {
	dispatch, embedsOf, fakeCommand, setupRendering, singleMessage
} from "../mocks/DiscordRenderHarness";

beforeAll(() => {
	setupRendering();
});

afterEach(() => {
	vi.restoreAllMocks();
	setupRendering();
});

/**
 * Draws of the random texts: the first, middle and last story of each list are displayed
 */
const DRAWS = [0, 0.5, 0.999];

/**
 * Small events whose whole outcome is a story, each with the icon of the small event and the texts the player must read
 */
const SMALL_EVENTS: [CrowniclesPacket, keyof typeof CrowniclesIcons.smallEvents, string[]][] = [
	[makePacket(SmallEventAdvanceTimePacket, { amount: 90 }), "advanceTime", ["1 heure et 30 minutes"]],
	[makePacket(SmallEventBoatAdvicePacket, {}), "boatAdvice", []],
	[makePacket(SmallEventDoNothingPacket, {}), "doNothing", []],
	[makePacket(SmallEventFarmerPacket, {
		interactionName: "salad", amount: 1
	}), "farmer", ["**une salade**"]],
	[makePacket(SmallEventFarmerPacket, {
		interactionName: "salad", amount: 4
	}), "farmer", ["**4 salades**"]],
	[makePacket(SmallEventFarmerPacket, { interactionName: "item" }), "farmer", []],
	[makePacket(SmallEventFindItemPacket, {}), "findItem", []],
	[makePacket(SmallEventFindPotionPacket, {}), "findPotion", []],
	[makePacket(SmallEventHauntedPacket, {}), "haunted", []],
	[makePacket(SmallEventSmallBadPacket, {
		amount: 15, issue: SmallEventBadIssue.HEALTH
	}), "smallBad", ["15"]],
	[makePacket(SmallEventSmallBadPacket, {
		amount: 60, issue: SmallEventBadIssue.MONEY
	}), "smallBad", ["60"]],
	[makePacket(SmallEventSmallBadPacket, {
		amount: 90, issue: SmallEventBadIssue.TIME, effectId: Effect.SLEEPING.id
	}), "smallBad", ["**1 heure et 30 minutes**"]],
	[makePacket(SmallEventSmallBadPacket, {
		amount: 90, issue: SmallEventBadIssue.TIME, effectId: Effect.OCCUPIED.id
	}), "smallBad", ["**1 heure et 30 minutes**"]],
	[makePacket(SmallEventStaffMemberPacket, {}), "staffMember", []],
	[makePacket(SmallEventUltimateFoodMerchantPacket, {
		interactionName: "ultimateFood", amount: 2
	}), "ultimateFoodMerchant", ["**2 soupes ultimes**"]],
	[makePacket(SmallEventUltimateFoodMerchantPacket, { interactionName: "fullUltimateFood" }), "ultimateFoodMerchant", ["plus la moindre place"]],
	[makePacket(SmallEventWinEnergyPacket, {}), "winEnergy", []],
	[makePacket(SmallEventWinEnergyOnIslandPacket, { amount: 25 }), "winEnergyOnIsland", []],
	[makePacket(SmallEventWinGuildXPPacket, {
		amount: 70, guildName: "TheGuild"
	}), "winGuildXP", ["TheGuild", "70"]],
	[makePacket(SmallEventWinHealthPacket, { amount: 35 }), "winHealth", ["35"]],
	[makePacket(SmallEventWinPersonalXPPacket, { amount: 45 }), "winPersonalXP", ["45"]]
];

describe("story small events", () => {
	it.each(SMALL_EVENTS)("%o is told in the report journal of the player", async (packet, smallEventId, expectedTexts) => {
		for (const draw of DRAWS) {
			vi.spyOn(Math, "random").mockReturnValue(draw);
			const {
				interaction, context
			} = fakeCommand("Traveller");
			await dispatch(context, packet);

			const message = singleMessage(interaction);
			expect(message.method).toBe("editReply");
			const [embed] = embedsOf(message);
			expect(embed.author?.name).toContain("Traveller");
			expect(embed.description?.startsWith(CrowniclesIcons.smallEvents[smallEventId])).toBe(true);
			// Durations are formatted with non-breaking spaces
			const description = embed.description?.replace(/[\u00a0\u202f]/g, " ");
			for (const expected of expectedTexts) {
				expect(description).toContain(expected);
			}
		}
	});
});
