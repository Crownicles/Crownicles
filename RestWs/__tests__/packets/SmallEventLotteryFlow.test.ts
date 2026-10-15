import {describe, expect, it} from "vitest";
import {makePacket, PacketContext} from "../../../Lib/src/packets/CrowniclesPacket";
import {
	SmallEventLotteryLosePacket,
	SmallEventLotteryNoAnswerPacket,
	SmallEventLotteryPoorPacket,
	SmallEventLotteryWinPacket
} from "../../../Lib/src/packets/smallEvents/SmallEventLotteryPacket";
import {
	SmallEventLotteryLoseRes,
	SmallEventLotteryNoAnswerRes,
	SmallEventLotteryPoorRes,
	SmallEventLotteryWinRes
} from "../../../WsPackets/src/fromServer/smallEvents/SmallEventLotteryRes";
import {getServerTranslator} from "../../src/packets/fromServer/FromServerTranslator";
import SmallEventLotteryServerTranslator from "../../src/packets/fromServer/translators/SmallEventLotteryServerTranslator";

function context(): PacketContext {
	return {frontEndOrigin: "test", frontEndSubOrigin: "test", webSocket: {}};
}

describe("lottery result over the WebSocket protocol", () => {
	it("registers every outcome sent by Core", () => {
		expect(getServerTranslator(SmallEventLotteryNoAnswerPacket.name)).toMatchObject({protoName: SmallEventLotteryNoAnswerRes.name});
		expect(getServerTranslator(SmallEventLotteryPoorPacket.name)).toMatchObject({protoName: SmallEventLotteryPoorRes.name});
		expect(getServerTranslator(SmallEventLotteryWinPacket.name)).toMatchObject({protoName: SmallEventLotteryWinRes.name});
		expect(getServerTranslator(SmallEventLotteryLosePacket.name)).toMatchObject({protoName: SmallEventLotteryLoseRes.name});
	});

	it("preserves the reward and the elapsed time of a winning choice", async () => {
		const source = makePacket(SmallEventLotteryWinPacket, {
			lostTime: 300_000,
			winAmount: 40,
			winReward: "money",
			level: "medium"
		});

		expect(await SmallEventLotteryServerTranslator.translateWin(context(), source)).toMatchObject(source);
	});

	it("preserves the loss applied by an unsuccessful choice", async () => {
		const source = makePacket(SmallEventLotteryLosePacket, {
			moneyLost: 100,
			lostTime: 300_000,
			level: "hard"
		});

		expect(await SmallEventLotteryServerTranslator.translateLose(context(), source)).toMatchObject(source);
	});
});
