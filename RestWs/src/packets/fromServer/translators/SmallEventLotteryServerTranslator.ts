import { fromServerTranslator } from "../FromServerTranslator";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import {
	SmallEventLotteryLosePacket,
	SmallEventLotteryNoAnswerPacket,
	SmallEventLotteryPoorPacket,
	SmallEventLotteryWinPacket
} from "../../../../../Lib/src/packets/smallEvents/SmallEventLotteryPacket";
import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";
import {
	SmallEventLotteryLoseRes,
	SmallEventLotteryNoAnswerRes,
	SmallEventLotteryPoorRes,
	SmallEventLotteryWinRes
} from "../../../../../WsPackets/src/fromServer/smallEvents/SmallEventLotteryRes";

export default class SmallEventLotteryServerTranslator {
	@fromServerTranslator(SmallEventLotteryNoAnswerPacket, SmallEventLotteryNoAnswerRes)
	public static translateNoAnswer(_context: PacketContext, _packet: SmallEventLotteryNoAnswerPacket): Promise<SmallEventLotteryNoAnswerRes> {
		return asyncMakeFromServerPacket(SmallEventLotteryNoAnswerRes, {});
	}

	@fromServerTranslator(SmallEventLotteryPoorPacket, SmallEventLotteryPoorRes)
	public static translatePoor(_context: PacketContext, _packet: SmallEventLotteryPoorPacket): Promise<SmallEventLotteryPoorRes> {
		return asyncMakeFromServerPacket(SmallEventLotteryPoorRes, {});
	}

	@fromServerTranslator(SmallEventLotteryWinPacket, SmallEventLotteryWinRes)
	public static translateWin(_context: PacketContext, packet: SmallEventLotteryWinPacket): Promise<SmallEventLotteryWinRes> {
		return asyncMakeFromServerPacket(SmallEventLotteryWinRes, {
			lostTime: packet.lostTime,
			winAmount: packet.winAmount,
			winReward: packet.winReward,
			level: packet.level
		});
	}

	@fromServerTranslator(SmallEventLotteryLosePacket, SmallEventLotteryLoseRes)
	public static translateLose(_context: PacketContext, packet: SmallEventLotteryLosePacket): Promise<SmallEventLotteryLoseRes> {
		return asyncMakeFromServerPacket(SmallEventLotteryLoseRes, {
			moneyLost: packet.moneyLost,
			lostTime: packet.lostTime,
			level: packet.level
		});
	}
}
