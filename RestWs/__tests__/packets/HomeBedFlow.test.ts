import {
	describe, expect, it
} from "vitest";
import {
	makePacket, PacketContext
} from "../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportHomeBedAlreadyFullRes, CommandReportHomeBedRes
} from "../../../Lib/src/packets/commands/CommandReportPacket";
import { HOME_BED_OUTCOMES } from "../../../WsPackets/src/fromServer/home/HomeBedRes";
import HomeBedServerTranslator from "../../src/packets/fromServer/translators/HomeBedServerTranslator";

function context(): PacketContext {
	return {
		frontEndOrigin: "test",
		frontEndSubOrigin: "test",
		webSocket: {}
	};
}

describe("home bed outcome", () => {
	it("tells the app how much health the rest gave back", async () => {
		const translated = await HomeBedServerTranslator.rested(context(), makePacket(CommandReportHomeBedRes, { health: 4 }));

		expect(translated.outcome).toEqual({
			type: HOME_BED_OUTCOMES.RESTED, health: 4
		});
	});

	it("tells the app the rest was not needed", async () => {
		const translated = await HomeBedServerTranslator.alreadyFull(context(), makePacket(CommandReportHomeBedAlreadyFullRes, {}));

		expect(translated.outcome).toEqual({ type: HOME_BED_OUTCOMES.ALREADY_FULL });
	});
});
