import {describe, expect, it} from "vitest";
import {SmallEventResultRes} from "../../../WsPackets/src/fromServer/smallEvents/SmallEventResultRes";
import {translateSmallEventResult} from "../../src/packets/fromServer/translators/SmallEventResultServerTranslator";

describe("generic small-event result over the WebSocket protocol", () => {
	it("preserves only the display fields used by the generic result renderer", async () => {
		const result = await translateSmallEventResult("SmallEventWinHealthPacket", {amount: 12});

		expect(result).toBeInstanceOf(SmallEventResultRes);
		expect(result).toEqual({eventName: "SmallEventWinHealthPacket", data: {amount: 12}});
	});

	it("does not expose internal player identifiers in generic results", async () => {
		const result = await translateSmallEventResult("SmallEventPetDropTokenPacket", {
			ownerKeycloakId: "internal-player-id",
			petTypeId: 12,
			amount: 1
		});

		expect(result.data).toEqual({amount: 1});
	});
});
