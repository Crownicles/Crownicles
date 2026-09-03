import {describe, expect, it} from "vitest";
import {makePacket} from "../../../Lib/src/packets/CrowniclesPacket";
import {SmallEventAltarContributedPacket} from "../../../Lib/src/packets/smallEvents/SmallEventAltarPacket";
import {SmallEventResultRes} from "../../../WsPackets/src/fromServer/smallEvents/SmallEventResultRes";
import {translateSmallEventResult} from "../../src/packets/fromServer/translators/SmallEventResultServerTranslator";

describe("generic small-event result over the WebSocket protocol", () => {
	it("preserves an altar resolution when no dedicated translator exists", async () => {
		const source = makePacket(SmallEventAltarContributedPacket, {
			amount: 130,
			blessingTriggered: false,
			blessingType: 0,
			newPoolAmount: 130,
			poolThreshold: 500,
			bonusGems: 0,
			bonusItemGiven: false,
			badgeAwarded: false
		});

		const result = await translateSmallEventResult(source.constructor.name, source);

		expect(result).toBeInstanceOf(SmallEventResultRes);
		expect(result).toMatchObject({eventName: "SmallEventAltarContributedPacket", data: source});
	});
});
