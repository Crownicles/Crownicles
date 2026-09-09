import {describe, expect, it} from "vitest";
import {SmallEventResultRes} from "../../../WsPackets/src/fromServer/smallEvents/SmallEventResultRes";
import {translateSmallEventResult} from "../../src/packets/fromServer/translators/SmallEventResultServerTranslator";

describe("generic small-event result over the WebSocket protocol", () => {
	/*
	 * Core has one result packet per small event, keyed by developer field names. The app cannot
	 * show those in the player's language, so the fallback announces the resolution and nothing
	 * else: the collector closes and the report refreshes instead of the player being stuck.
	 */
	it("announces the resolution without leaking the Core payload", async () => {
		const result = await translateSmallEventResult();

		expect(result).toBeInstanceOf(SmallEventResultRes);
		expect(Object.keys(result)).toEqual([]);
	});
});
