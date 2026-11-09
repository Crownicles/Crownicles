import {describe, expect, it} from "vitest";
import {makePacket, PacketContext} from "../../../Lib/src/packets/CrowniclesPacket";
import {ItemRefusePacket} from "../../../Lib/src/packets/events/ItemRefusePacket";
import {ItemRefusedRes} from "../../../WsPackets/src/fromServer/inventory/ItemRefusedRes";
import ItemServerTranslator from "../../src/packets/fromServer/translators/ItemServerTranslator";
import {getServerTranslator} from "../../src/packets/fromServer/FromServerTranslator";

const CONTEXT: PacketContext = {frontEndOrigin: "websocket", frontEndSubOrigin: "", keycloakId: "authenticated-player", webSocket: {}};

describe("item leaving the inventory after a find", () => {
	it("reaches the app under its own wire name", () => {
		expect(getServerTranslator(ItemRefusePacket.name)?.protoName).toBe(ItemRefusedRes.wireName);
	});

	it("keeps the amount announced by Core and whether the sale was automatic", async () => {
		const result = await ItemServerTranslator.refused(CONTEXT, makePacket(ItemRefusePacket, {
			item: {id: 7, category: 0},
			autoSell: true,
			soldMoney: 132
		}));
		expect(result).toBeInstanceOf(ItemRefusedRes);
		expect(JSON.parse(JSON.stringify(result))).toEqual({item: {id: 7, category: 0}, autoSell: true, soldMoney: 132});
	});
});
