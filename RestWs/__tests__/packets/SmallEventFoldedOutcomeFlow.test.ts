import {afterEach, describe, expect, it, vi} from "vitest";
import {MqttManager} from "../../src/mqtt/MqttManager";
import {GlobalMqttClient} from "../../src/mqtt/GlobalMqttClient";
import {WebSocketServer} from "../../src/services/WebSocketServer";
import {CrowniclesPacket, makePacket, PacketContext} from "../../../Lib/src/packets/CrowniclesPacket";
import {ItemFoundPacket} from "../../../Lib/src/packets/events/ItemFoundPacket";
import {GiveFoodToGuildPacket} from "../../../Lib/src/packets/utils/GiveFoodToGuildPacket";
import {ReactionCollectorCreationPacket} from "../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import {
	ReactionCollectorRecipeShopSmallEvent, ReactionCollectorRecipeShopSmallEventData, RecipeShopSource
} from "../../../Lib/src/packets/interaction/ReactionCollectorRecipeShopSmallEvent";
import {ItemWithDetails} from "../../../Lib/src/types/ItemWithDetails";
import {RecipeDisplayInfo} from "../../../Lib/src/types/CookingTypes";
import {RecipeType} from "../../../Lib/src/constants/CookingConstants";
import {SmallEventResultRes} from "../../../WsPackets/src/fromServer/smallEvents/SmallEventResultRes";
import {ItemFoundRes} from "../../../WsPackets/src/fromServer/inventory/ItemFoundRes";
import {ReactionCollectorCreation} from "../../../WsPackets/src/fromServer/common/ReactionCollectorCreation";
import {SMALL_EVENT_DATA_KINDS} from "../../../WsPackets/src/fromServer/collectors";
import "../../src/packets/fromServer/translators/ReactionCollectorCreationServerTranslator";
import "../../src/packets/fromServer/translators/ItemServerTranslator";

vi.mock("../../src/index", () => ({keycloakConfig: {}, restWsConfig: {PREFIX: "test"}}));
vi.mock("mqtt", () => ({connect: vi.fn(() => ({on: vi.fn(), publish: vi.fn(), subscribe: vi.fn()}))}));

const CONTEXT: PacketContext = {
	frontEndOrigin: "websocket", frontEndSubOrigin: "", keycloakId: "player", webSocket: {}, packetId: "report"
};

const RECIPE: RecipeDisplayInfo = {recipeId: "championFeast", level: 7, recipeType: RecipeType.PETFOOD_ULTIMATE};

const FOUND_ITEM = {
	id: 7,
	rarity: 1,
	itemCategory: 0,
	itemLevel: 2,
	attack: {baseValue: 1, upgradeValue: 2, maxValue: 3},
	defense: {baseValue: 1, upgradeValue: 2, maxValue: 3},
	speed: {baseValue: 1, upgradeValue: 2, maxValue: 3}
} as unknown as ItemWithDetails;

/** The offer Core builds when the small event also sells a recipe, with what the event gave folded in. */
function recipeOffer(folded: Pick<ReactionCollectorRecipeShopSmallEventData, "source" | "farmer" | "ultimateFoodMerchant">): ReactionCollectorCreationPacket {
	return makePacket(ReactionCollectorCreationPacket, new ReactionCollectorRecipeShopSmallEvent({
		...folded, recipe: RECIPE, recipeCost: 350
	}).creationPacket("recipe-offer", 1_700_000_000_000));
}

/** Publishes a reply exactly as Core does, and returns what the app receives for it. */
async function replyFromCore(packets: CrowniclesPacket[]): Promise<{name: string; id?: string; packet: object}[]> {
	MqttManager.globalMqttClient = new GlobalMqttClient("mqtt://test", {});
	const dispatch = vi.spyOn(WebSocketServer, "dispatchPacketsToClient").mockImplementation(() => undefined);
	await MqttManager.globalMqttClient.onMessage(JSON.stringify({
		context: CONTEXT,
		packets: packets.map(packet => ({name: packet.constructor.name, packet}))
	}));
	expect(dispatch).toHaveBeenCalledOnce();
	return JSON.parse(JSON.stringify(dispatch.mock.calls[0][1]));
}

describe("small events telling their outcome inside the question they chain", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("tells what Gaspard-Jo gave before he offers a recipe, after the item he handed over", async () => {
		const received = await replyFromCore([
			makePacket(ItemFoundPacket, {itemWithDetails: FOUND_ITEM, kept: true}),
			recipeOffer({source: RecipeShopSource.GASPARD_JO, ultimateFoodMerchant: {interactionName: "item"}})
		]);

		expect(received.map(packet => packet.name)).toEqual([ItemFoundRes.wireName, SmallEventResultRes.wireName, ReactionCollectorCreation.wireName]);
		expect(received[1]).toEqual({
			id: "report",
			name: SmallEventResultRes.wireName,
			packet: {eventName: "SmallEventUltimateFoodMerchantPacket", data: {interactionName: "item"}}
		});
		expect(received[2]).toMatchObject({id: "report", packet: {id: "recipe-offer", data: {type: SMALL_EVENT_DATA_KINDS.RECIPE_SHOP}}});
	});

	it("tells the salads the farmer gave to the guild before he offers a recipe", async () => {
		const received = await replyFromCore([
			makePacket(GiveFoodToGuildPacket, {quantity: 2, selectedFoodIndex: 2}),
			recipeOffer({source: RecipeShopSource.FARMER, farmer: {interactionName: "salad", amount: 2}})
		]);

		expect(received.map(packet => packet.name)).toEqual([SmallEventResultRes.wireName, ReactionCollectorCreation.wireName]);
		expect(received[0].packet).toEqual({eventName: "SmallEventFarmerPacket", data: {interactionName: "salad", amount: 2}});
		expect(received[1].packet).toMatchObject({data: {type: SMALL_EVENT_DATA_KINDS.RECIPE_SHOP, data: {source: "farmer", recipeCost: 350}}});
	});

	it("sends a question that carries no outcome on its own", async () => {
		const received = await replyFromCore([recipeOffer({source: RecipeShopSource.FARMER})]);

		expect(received.map(packet => packet.name)).toEqual([ReactionCollectorCreation.wireName]);
	});
});
