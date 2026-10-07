import { describe, expect, it } from "vitest";
import { makePacket, PacketContext } from "../../../Lib/src/packets/CrowniclesPacket";
import { CommandAdventureHistoryRes } from "../../../Lib/src/packets/commands/CommandAdventureHistoryPacket";
import { AdventureHistoryConstants } from "../../../Lib/src/constants/AdventureHistoryConstants";
import { asSeconds } from "../../../Lib/src/utils/TimeUtils";
import { AdventureHistoryReq } from "../../../WsPackets/src/fromClient/AdventureHistoryReq";
import AdventureHistoryClientTranslator from "../../src/packets/fromClient/translators/AdventureHistoryClientTranslator";
import AdventureHistoryServerTranslator from "../../src/packets/fromServer/translators/AdventureHistoryServerTranslator";
import { InvalidClientPacketError } from "../../src/packets/fromClient/InvalidClientPacketError";

const CONTEXT: PacketContext = { keycloakId: "authenticated", frontEndOrigin: "websocket", frontEndSubOrigin: "", webSocket: {} };

describe("adventure history protocol", () => {
	it("forwards only pagination and never a client-supplied player identity", async () => {
		const request = Object.assign(new AdventureHistoryReq(), { page: 1, until: 2_000_000, keycloakId: "victim" });

		const packet = await AdventureHistoryClientTranslator.translate(CONTEXT, request);

		expect(packet.page).toBe(1);
		expect(packet.until).toBe(2_000);
		expect(packet.keycloakId).not.toBe("victim");
	});

	it.each([-1, 0.5, AdventureHistoryConstants.MAX_PAGE + 1])("rejects the untrusted page %s", page => {
		expect(() => AdventureHistoryClientTranslator.translate(CONTEXT, Object.assign(new AdventureHistoryReq(), { page })))
			.toThrow(InvalidClientPacketError);
	});

	it("returns display timestamps in milliseconds and leaves an absent next page absent", async () => {
		const packet = makePacket(CommandAdventureHistoryRes, {
			available: true,
			entries: [{ date: asSeconds(1_000), eventId: 60, possibilityId: "start", outcomeId: "0" }],
			until: asSeconds(2_000),
			windowStartsAt: asSeconds(100)
		});

		const result = await AdventureHistoryServerTranslator.translate(CONTEXT, packet);

		expect(result.entries[0].date).toBe(1_000_000);
		expect(result.until).toBe(2_000_000);
		expect(result.windowStartsAt).toBe(100_000);
		expect(result.available).toBe(true);
		expect(result).not.toHaveProperty("nextPage");
	});
});