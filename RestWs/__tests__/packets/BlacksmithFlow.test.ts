import {
	describe, expect, it
} from "vitest";
import {
	makePacket, PacketContext
} from "../../../Lib/src/packets/CrowniclesPacket";
import { CommandReportBlacksmithEnchantmentTransferRes } from "../../../Lib/src/packets/commands/CommandReportPacket";
import { BlacksmithEnchantmentTransferRes } from "../../../WsPackets/src/fromServer/report/BlacksmithEnchantmentTransferRes";
import { getServerTranslator } from "../../src/packets/fromServer/FromServerTranslator";
import BlacksmithServerTranslator from "../../src/packets/fromServer/translators/BlacksmithServerTranslator";

const CONTEXT: PacketContext = {
	keycloakId: "authenticated", frontEndOrigin: "websocket", frontEndSubOrigin: "", webSocket: {}
};

describe("blacksmith enchantment transfer outcome", () => {
	it("answers the app with the enchantment moved and its price", async () => {
		const translator = getServerTranslator(CommandReportBlacksmithEnchantmentTransferRes.name);
		expect(translator?.protoName).toBe(BlacksmithEnchantmentTransferRes.wireName);
		const translated = await BlacksmithServerTranslator.enchantmentTransfer(CONTEXT, makePacket(CommandReportBlacksmithEnchantmentTransferRes, {
			enchantmentId: "attack1", enchantmentType: "damage", cost: 1200
		}));
		expect(JSON.parse(JSON.stringify(translated))).toEqual({
			enchantmentId: "attack1", enchantmentType: "damage", cost: 1200
		});
	});
});
