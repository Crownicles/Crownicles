import {describe, expect, it} from "vitest";
import {makePacket, PacketContext} from "../../../Lib/src/packets/CrowniclesPacket";
import {CommandShopGenericPurchase, CommandShopNoPlantSlotAvailable} from "../../../Lib/src/packets/interaction/ReactionCollectorShop";
import {ShopItemType} from "../../../Lib/src/constants/LogsConstants";
import {GARDENER_INTERACTIONS, PLANT_RECEPTION_FAILURES, PlantId, SEED_CONDITION_FAILURE} from "../../../Lib/src/constants/PlantConstants";
import {SmallEventGardenerPacket} from "../../../Lib/src/packets/smallEvents/SmallEventGardenerPacket";
import {ShopOutcomeRes} from "../../../WsPackets/src/fromServer/shop/ShopRes";
import {SmallEventChoiceResultRes} from "../../../WsPackets/src/fromServer/smallEvents/SmallEventChoiceResultRes";
import {getServerTranslator} from "../../src/packets/fromServer/FromServerTranslator";
import ShopServerTranslator from "../../src/packets/fromServer/translators/ShopServerTranslator";
import "../../src/packets/fromServer/translators/SmallEventChoiceResultServerTranslator";

const CONTEXT: PacketContext = {keycloakId: "authenticated", frontEndOrigin: "websocket", frontEndSubOrigin: "", webSocket: {}};

describe("plants delivered to the home chest", () => {
	it("tells how many bought plants went straight to the home chest", async () => {
		const linked = await ShopServerTranslator.purchased(CONTEXT, makePacket(CommandShopGenericPurchase, {shopItemId: ShopItemType.WEEKLY_PLANT_TIER_1, amount: 10, plantsSentToHomeStorage: 8}));
		const carried = await ShopServerTranslator.purchased(CONTEXT, makePacket(CommandShopGenericPurchase, {shopItemId: ShopItemType.WEEKLY_PLANT_TIER_1, amount: 1}));
		expect(linked.outcome).toEqual({kind: "purchase", shopItemId: "weeklyPlantTier1", amount: 10, plantsSentToHomeStorage: 8});
		expect(carried.outcome).not.toHaveProperty("plantsSentToHomeStorage");
	});

	it("says why bought plants could not be received, and still answers when Core does not know", async () => {
		const translate = getServerTranslator(CommandShopNoPlantSlotAvailable.name)!;
		expect(translate.protoName).toBe(ShopOutcomeRes.wireName);
		expect(await translate.translatorFunc(CONTEXT, makePacket(CommandShopNoPlantSlotAvailable, {reason: PLANT_RECEPTION_FAILURES.HOME_STORAGE_FULL}))).toMatchObject({outcome: {kind: "noPlantSlot", reason: "homeStorageFull"}});
		const unknown = await translate.translatorFunc(CONTEXT, makePacket(CommandShopNoPlantSlotAvailable, {})) as ShopOutcomeRes;
		expect(unknown.outcome).toEqual({kind: "noPlantSlot"});
	});

	it("tells when the plant a gardener gave went to the home chest", async () => {
		const translate = getServerTranslator(SmallEventGardenerPacket.name)!.translatorFunc;
		const gift = {interactionName: GARDENER_INTERACTIONS.PLANT, plantId: PlantId.CRYSTAL_FLOWER, materialId: 0, cost: 0, conditionKey: SEED_CONDITION_FAILURE.NONE};
		const linked = await translate(CONTEXT, makePacket(SmallEventGardenerPacket, {...gift, sentToHomeStorage: true})) as SmallEventChoiceResultRes;
		const carried = await translate(CONTEXT, makePacket(SmallEventGardenerPacket, gift)) as SmallEventChoiceResultRes;
		expect(linked.result).toMatchObject({event: "gardener", interactionName: "plant", sentToHomeStorage: true});
		expect(carried.result).not.toHaveProperty("sentToHomeStorage");
	});
});
