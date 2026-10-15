import {
	describe, expect, it
} from "vitest";
import {
	makePacket, PacketContext
} from "../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportBlacksmithUpgradeRes, CommandReportRoyalBlacksmithUpgradeRes, CommandReportUpgradeItemRes
} from "../../../Lib/src/packets/commands/CommandReportPacket";
import { RoyalBlacksmithConstants } from "../../../Lib/src/constants/BlacksmithConstants";
import { ITEM_UPGRADE_ARTISANS } from "../../../WsPackets/src/fromServer/report/ItemUpgradeRes";
import ItemUpgradeServerTranslator from "../../src/packets/fromServer/translators/ItemUpgradeServerTranslator";

function context(): PacketContext {
	return {
		frontEndOrigin: "test",
		frontEndSubOrigin: "test",
		webSocket: {}
	};
}

describe("item upgrade outcome", () => {
	it("tells the app which item the home station raised, for free", async () => {
		const translated = await ItemUpgradeServerTranslator.home(context(), makePacket(CommandReportUpgradeItemRes, {
			itemCategory: 1, itemId: 7, newItemLevel: 2
		}));

		expect(translated).toMatchObject({
			artisan: ITEM_UPGRADE_ARTISANS.HOME, itemId: 7, itemCategory: 1, itemLevel: 2, moneySpent: 0
		});
	});

	it("passes on the blacksmith's whole bill, bought materials included", async () => {
		const translated = await ItemUpgradeServerTranslator.blacksmith(context(), makePacket(CommandReportBlacksmithUpgradeRes, {
			itemCategory: 0, itemId: 10, newItemLevel: 3, totalCost: 5_775, boughtMaterials: true
		}));

		expect(translated).toMatchObject({
			artisan: ITEM_UPGRADE_ARTISANS.BLACKSMITH, itemId: 10, itemLevel: 3, moneySpent: 5_775
		});
	});

	it("adds the royal blacksmith's materials to the coins and keeps the gems apart", async () => {
		const translated = await ItemUpgradeServerTranslator.royalBlacksmith(context(), makePacket(CommandReportRoyalBlacksmithUpgradeRes, {
			itemCategory: 0, itemId: 10, upgradeCost: 7_500, materialsCost: 500, gemCost: 3, boughtMaterials: true
		}));

		expect(translated).toMatchObject({
			artisan: ITEM_UPGRADE_ARTISANS.ROYAL_BLACKSMITH, itemLevel: RoyalBlacksmithConstants.TARGET_LEVEL, moneySpent: 8_000, gemsSpent: 3
		});
	});
});
