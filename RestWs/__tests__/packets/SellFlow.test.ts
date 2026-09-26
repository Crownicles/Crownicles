import {describe, expect, it} from "vitest";
import {makePacket, PacketContext} from "../../../Lib/src/packets/CrowniclesPacket";
import {CommandSellCancelErrorPacket, CommandSellItemSuccessPacket, CommandSellNoItemErrorPacket, CommandSellPacketReq} from "../../../Lib/src/packets/commands/CommandSellPacket";
import {ReactionCollectorSell} from "../../../Lib/src/packets/interaction/ReactionCollectorSell";
import {ReactionCollectorReactReq} from "../../../WsPackets/src/fromClient/ReactionCollectorReactReq";
import {SellReq} from "../../../WsPackets/src/fromClient/SellReq";
import {SellCancelRes, SellNoItemRes} from "../../../WsPackets/src/fromServer/inventory/SellRes";
import {GENERIC_REACTION_KINDS, SELL_DATA_KINDS, SELL_REACTION_KINDS} from "../../../WsPackets/src/fromServer/collectors";
import SellCommandClientTranslator from "../../src/packets/fromClient/translators/SellCommandClientTranslator";
import SellCommandServerTranslator from "../../src/packets/fromServer/translators/SellCommandServerTranslator";
import ReactionCollectorReactClientTranslator from "../../src/packets/fromClient/translators/ReactionCollectorReactClientTranslator";
import {mapCollectorCreation} from "../../src/packets/fromServer/collectors/ReactionCollectorMapper";

const CONTEXT: PacketContext = {frontEndOrigin: "websocket", frontEndSubOrigin: "", keycloakId: "authenticated-player", webSocket: {}};

describe("selling over WebSocket", () => {
	it("opens the existing Core command", async () => {
		expect(await SellCommandClientTranslator.open(CONTEXT, new SellReq())).toBeInstanceOf(CommandSellPacketReq);
	});

	it("keeps sale prices, reserve slots and refusal in their original positions", async () => {
		const opened = new ReactionCollectorSell([{item: {id: 7, category: 0}, slot: 3, price: 120}, {item: {id: 43, category: 2}, slot: 1, price: 0}]).creationPacket("sale", 1_900_000_000_000);
		const offered = mapCollectorCreation(JSON.parse(JSON.stringify(opened)));
		expect(offered.data.type).toBe(SELL_DATA_KINDS.COLLECTOR);
		expect(offered.reactions).toEqual([{type: SELL_REACTION_KINDS.ITEM, data: {item: {id: 7, category: 0}, slot: 3, price: 120}}, {type: SELL_REACTION_KINDS.ITEM, data: {item: {id: 43, category: 2}, slot: 1, price: 0}}, {type: GENERIC_REACTION_KINDS.REFUSE, data: {}}]);
		const reaction = await ReactionCollectorReactClientTranslator.translate(CONTEXT, Object.assign(new ReactionCollectorReactReq(), {collectorId: "sale", reactionIndex: 1}));
		expect(opened.reactions[reaction.reactionIndex].data).toMatchObject({item: {id: 43}, slot: 1, price: 0});
	});

	it("uses the credited amount from Core in the outcome", async () => {
		const result = await SellCommandServerTranslator.success(CONTEXT, makePacket(CommandSellItemSuccessPacket, {item: {id: 7, category: 0}, price: 132}));
		expect(JSON.parse(JSON.stringify(result))).toEqual({item: {id: 7, category: 0}, price: 132});
	});

	it("translates empty inventories and cancellation", async () => {
		expect(await SellCommandServerTranslator.noItem(CONTEXT, makePacket(CommandSellNoItemErrorPacket, {}))).toBeInstanceOf(SellNoItemRes);
		expect(await SellCommandServerTranslator.cancel(CONTEXT, makePacket(CommandSellCancelErrorPacket, {}))).toBeInstanceOf(SellCancelRes);
	});
});
