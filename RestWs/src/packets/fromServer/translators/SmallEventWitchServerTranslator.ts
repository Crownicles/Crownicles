import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { SmallEventWitchResultPacket } from "../../../../../Lib/src/packets/smallEvents/SmallEventWitchPacket";
import { WitchActionOutcomeType } from "../../../../../Lib/src/types/WitchActionOutcomeType";
import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";
import {
	SmallEventWitchResultRes, WITCH_OUTCOMES, WitchOutcome
} from "../../../../../WsPackets/src/fromServer/smallEvents/SmallEventWitchResultRes";
import { fromServerTranslator } from "../FromServerTranslator";

function toWitchOutcome(outcome: WitchActionOutcomeType): WitchOutcome {
	switch (outcome) {
		case WitchActionOutcomeType.POTION:
			return WITCH_OUTCOMES.POTION;
		case WitchActionOutcomeType.EFFECT:
			return WITCH_OUTCOMES.EFFECT;
		case WitchActionOutcomeType.LIFE_LOSS:
			return WITCH_OUTCOMES.LIFE_LOSS;
		case WitchActionOutcomeType.NOTHING:
			return WITCH_OUTCOMES.NOTHING;
		default:
			throw new Error(`Unsupported witch outcome: ${outcome}`);
	}
}

export default class SmallEventWitchServerTranslator {
	@fromServerTranslator(SmallEventWitchResultPacket, SmallEventWitchResultRes)
	public static translate(_context: PacketContext, packet: SmallEventWitchResultPacket): Promise<SmallEventWitchResultRes> {
		return asyncMakeFromServerPacket(SmallEventWitchResultRes, {
			ingredientId: packet.ingredientId,
			isIngredient: packet.isIngredient,
			forceEffect: packet.forceEffect,
			effectId: packet.effectId,
			timeLostMinutes: packet.timeLost,
			lifeLoss: packet.lifeLoss,
			outcome: toWitchOutcome(packet.outcome),
			...packet.discoveredRecipe === undefined ? {} : { discoveredRecipe: packet.discoveredRecipe }
		});
	}
}
