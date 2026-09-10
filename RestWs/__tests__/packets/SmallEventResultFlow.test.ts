import {describe, expect, it} from "vitest";
import {SmallEventResultRes} from "../../../WsPackets/src/fromServer/smallEvents/SmallEventResultRes";
import {translateSmallEventResult} from "../../src/packets/fromServer/translators/SmallEventResultServerTranslator";

describe("generic small-event result over the WebSocket protocol", () => {
	it("preserves the event identity and payload for the generic result renderer", async () => {
		const result = await translateSmallEventResult("SmallEventWinHealthPacket", {amount: 12});

		expect(result).toBeInstanceOf(SmallEventResultRes);
		expect(result).toEqual({eventName: "SmallEventWinHealthPacket", data: {amount: 12}});
	});
});
