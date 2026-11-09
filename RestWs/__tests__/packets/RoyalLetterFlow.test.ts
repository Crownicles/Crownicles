import {
	describe, expect, it
} from "vitest";
import {
	makePacket, PacketContext
} from "../../../Lib/src/packets/CrowniclesPacket";
import { RoyalLetterPacket } from "../../../Lib/src/packets/events/RoyalLetterPacket";
import { RoyalLetterRes } from "../../../WsPackets/src/fromServer/onboarding/RoyalLetterRes";
import RoyalLetterServerTranslator from "../../src/packets/fromServer/translators/RoyalLetterServerTranslator";

const CONTEXT: PacketContext = {
	frontEndOrigin: "websocket", frontEndSubOrigin: "", keycloakId: "authenticated-player", webSocket: {}
};

describe("royal mail over WebSocket", () => {
	it("hands the letter and its gifts over without the player's identity", async () => {
		const packet = makePacket(RoyalLetterPacket, {
			keycloakId: "private-id", letter: 7, letters: 7, tokens: 20, money: 2000, gems: 5, rank: 12, rankedPlayers: 340
		});
		const result = await RoyalLetterServerTranslator.translate(CONTEXT, JSON.parse(JSON.stringify(packet)));
		expect(result).toBeInstanceOf(RoyalLetterRes);
		expect(result).toEqual(Object.assign(new RoyalLetterRes(), {
			letter: 7, letters: 7, tokens: 20, money: 2000, gems: 5, rank: 12, rankedPlayers: 340
		}));
		expect(result).not.toHaveProperty("keycloakId");
	});

	it("says nothing of a rank the player does not have yet", async () => {
		const packet = makePacket(RoyalLetterPacket, {
			keycloakId: "private-id", letter: 1, letters: 7, tokens: 20, money: 2000, gems: 0
		});
		expect(await RoyalLetterServerTranslator.translate(CONTEXT, packet)).not.toHaveProperty("rank");
	});
});
