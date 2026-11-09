import {
	describe, expect, it
} from "vitest";
import {
	makePacket, PacketContext
} from "../../../Lib/src/packets/CrowniclesPacket";
import { CommandReportEnchanterDisenchantRes } from "../../../Lib/src/packets/commands/CommandReportPacket";
import { EnchanterDisenchantRes } from "../../../WsPackets/src/fromServer/report/EnchanterDisenchantRes";
import { getServerTranslator } from "../../src/packets/fromServer/FromServerTranslator";
import EnchanterServerTranslator from "../../src/packets/fromServer/translators/EnchanterServerTranslator";

const CONTEXT: PacketContext = {
	keycloakId: "authenticated", frontEndOrigin: "websocket", frontEndSubOrigin: "", webSocket: {}
};

describe("enchanter disenchant outcome", () => {
	it("answers the app with the enchantment Mernil removed", async () => {
		const translator = getServerTranslator(CommandReportEnchanterDisenchantRes.name);
		expect(translator?.protoName).toBe(EnchanterDisenchantRes.wireName);
		const translated = await EnchanterServerTranslator.disenchant(CONTEXT, makePacket(CommandReportEnchanterDisenchantRes, {
			enchantmentId: "attack1", enchantmentType: "damage"
		}));
		expect(JSON.parse(JSON.stringify(translated))).toEqual({
			enchantmentId: "attack1", enchantmentType: "damage"
		});
	});
});
