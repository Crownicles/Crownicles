import {
	describe, expect, it
} from "vitest";
import {
	makePacket, PacketContext
} from "../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportTokenMerchantBoughtRes,
	CommandReportBuyHealAcceptPacketRes,
	CommandReportBuyHealPacketReq,
	CommandReportUseTokensAcceptPacketRes,
	CommandReportUseTokensPacketReq
} from "../../../Lib/src/packets/commands/CommandReportPacket";
import { ReactionCollectorBuyHeal } from "../../../Lib/src/packets/interaction/ReactionCollectorBuyHeal";
import { ReactionCollectorTokenMerchant } from "../../../Lib/src/packets/interaction/ReactionCollectorTokenMerchant";
import { ReactionCollectorUseTokens } from "../../../Lib/src/packets/interaction/ReactionCollectorUseTokens";
import { makeFromClientPacket } from "../../../WsPackets/src/MakePackets";
import { ReportUseTokensReq } from "../../../WsPackets/src/fromClient/ReportUseTokensReq";
import { ReportBuyHealReq } from "../../../WsPackets/src/fromClient/ReportBuyHealReq";
import {
	GENERIC_REACTION_KINDS, REPORT_COLLECTOR_DATA_KINDS, REPORT_COLLECTOR_REACTION_KINDS
} from "../../../WsPackets/src/fromServer/collectors";
import {
	ReportTokenMerchantBoughtRes, ReportUseTokensAcceptedRes
} from "../../../WsPackets/src/fromServer/report/ReportTokenRes";
import { ReportBuyHealAcceptedRes } from "../../../WsPackets/src/fromServer/report/ReportHealRes";
import { getClientTranslator } from "../../src/packets/fromClient/FromClientTranslator";
import ReportCommandClientTranslator from "../../src/packets/fromClient/translators/ReportCommandClientTranslator";
import { getServerTranslator } from "../../src/packets/fromServer/FromServerTranslator";
import { mapCollectorCreation } from "../../src/packets/fromServer/collectors/ReactionCollectorMapper";
import ReportTokenServerTranslator from "../../src/packets/fromServer/translators/ReportTokenServerTranslator";
import ReportHealServerTranslator from "../../src/packets/fromServer/translators/ReportHealServerTranslator";

const END_TIME = 1_700_000_000_000;

function context(): PacketContext {
	return {frontEndOrigin: "test", frontEndSubOrigin: "test", webSocket: {}};
}

describe("report token flow over the WebSocket protocol", () => {
	it("registers the token request and terminal result translators", () => {
		expect(getClientTranslator(ReportUseTokensReq.name)).toBeDefined();
		expect(getServerTranslator(CommandReportUseTokensAcceptPacketRes.name)).toMatchObject({
			protoName: ReportUseTokensAcceptedRes.name
		});
		expect(getServerTranslator(CommandReportTokenMerchantBoughtRes.name)).toMatchObject({
			protoName: ReportTokenMerchantBoughtRes.name
		});
		expect(getClientTranslator(ReportBuyHealReq.name)).toBeDefined();
		expect(getServerTranslator(CommandReportBuyHealAcceptPacketRes.name)).toMatchObject({
			protoName: ReportBuyHealAcceptedRes.name
		});
	});

	it("turns an advance request into the command expected by Core", async () => {
		const translated = await ReportCommandClientTranslator.translateUseTokens(context(), makeFromClientPacket(ReportUseTokensReq, {}));

		expect(translated).toBeInstanceOf(CommandReportUseTokensPacketReq);
	});

	it("turns a cure request into the command expected by Core", async () => {
		const translated = await ReportCommandClientTranslator.translateBuyHeal(context(), makeFromClientPacket(ReportBuyHealReq, {}));

		expect(translated).toBeInstanceOf(CommandReportBuyHealPacketReq);
	});

	it("keeps the token confirmation and merchant choices in their server order", () => {
		const useTokens = mapCollectorCreation(new ReactionCollectorUseTokens(2, 4).creationPacket("use", END_TIME, false));
		const merchant = mapCollectorCreation(new ReactionCollectorTokenMerchant(375, 2_000, 0, [1, 5]).creationPacket("merchant", END_TIME, false));

		expect(useTokens).toMatchObject({
			data: {type: REPORT_COLLECTOR_DATA_KINDS.USE_TOKENS, data: {cost: 2, playerTokens: 4}},
			reactions: [
				{type: GENERIC_REACTION_KINDS.ACCEPT, data: {}},
				{type: GENERIC_REACTION_KINDS.REFUSE, data: {}}
			]
		});
		expect(merchant).toMatchObject({
			data: {
				type: REPORT_COLLECTOR_DATA_KINDS.TOKEN_MERCHANT,
				data: {pricePerToken: 375, playerMoney: 2_000, playerTokens: 0, maxTokens: 20, maxDaily: 10, maxWeekly: 30, amounts: [1, 5]}
			},
			reactions: [
				{type: REPORT_COLLECTOR_REACTION_KINDS.TOKEN_MERCHANT_BUY, data: {amount: 1}},
				{type: REPORT_COLLECTOR_REACTION_KINDS.TOKEN_MERCHANT_BUY, data: {amount: 5}},
				{type: GENERIC_REACTION_KINDS.REFUSE, data: {}}
			]
		});
	});

	it("keeps the alteration cure price and confirmation choices from the server", () => {
		const heal = mapCollectorCreation(new ReactionCollectorBuyHeal(410, 1_000).creationPacket("heal", END_TIME, false));

		expect(heal).toMatchObject({
			data: {type: REPORT_COLLECTOR_DATA_KINDS.BUY_HEAL, data: {healPrice: 410, playerMoney: 1_000}},
			reactions: [
				{type: GENERIC_REACTION_KINDS.ACCEPT, data: {}},
				{type: GENERIC_REACTION_KINDS.REFUSE, data: {}}
			]
		});
	});

	it("transports the spent and bought amounts to the mobile result screens", async () => {
		const accepted = await ReportTokenServerTranslator.translateUseTokensAccepted(context(), makePacket(CommandReportUseTokensAcceptPacketRes, {
			tokensSpent: 2,
			isArrived: false
		}));
		const bought = await ReportTokenServerTranslator.translateMerchantBought(context(), makePacket(CommandReportTokenMerchantBoughtRes, {amount: 5}));

		expect(accepted).toMatchObject({tokensSpent: 2, isArrived: false});
		expect(bought).toMatchObject({amount: 5});
	});

	it("transports the cure price and arrival state to the mobile result screen", async () => {
		const accepted = await ReportHealServerTranslator.translateAccepted(context(), makePacket(CommandReportBuyHealAcceptPacketRes, {
			healPrice: 410,
			isArrived: true
		}));

		expect(accepted).toMatchObject({healPrice: 410, isArrived: true});
	});
});
