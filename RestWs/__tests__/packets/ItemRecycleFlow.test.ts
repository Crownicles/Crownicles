import {
	describe, expect, it
} from "vitest";
import {
	makePacket, PacketContext
} from "../../../Lib/src/packets/CrowniclesPacket";
import { CommandReportScrapDealerRecycleRes } from "../../../Lib/src/packets/commands/CommandReportPacket";
import ItemRecycleServerTranslator from "../../src/packets/fromServer/translators/ItemRecycleServerTranslator";

function context(): PacketContext {
	return {
		frontEndOrigin: "test",
		frontEndSubOrigin: "test",
		webSocket: {}
	};
}

describe("item recycle outcome", () => {
	it("tells the app which item was dismantled and everything it gave back", async () => {
		const translated = await ItemRecycleServerTranslator.recycle(context(), makePacket(CommandReportScrapDealerRecycleRes, {
			itemId: 1,
			itemCategory: 0,
			itemLevel: 5,
			materialLoot: [
				{
					materialId: 68, quantity: 2
				},
				{
					materialId: 34, quantity: 1
				}
			],
			moneyGained: 1_019
		}));

		expect(translated).toMatchObject({
			itemId: 1,
			itemCategory: 0,
			itemLevel: 5,
			materials: [
				{
					materialId: 68, quantity: 2
				},
				{
					materialId: 34, quantity: 1
				}
			],
			moneyGained: 1_019
		});
	});
});
