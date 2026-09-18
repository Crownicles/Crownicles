import {describe, expect, it} from "vitest";
import {makePacket, PacketContext} from "../../../Lib/src/packets/CrowniclesPacket";
import {SmallEventWitchResultPacket} from "../../../Lib/src/packets/smallEvents/SmallEventWitchPacket";
import {WitchActionOutcomeType} from "../../../Lib/src/types/WitchActionOutcomeType";
import {SmallEventWitchResultRes} from "../../../WsPackets/src/fromServer/smallEvents/SmallEventWitchResultRes";
import {getServerTranslator} from "../../src/packets/fromServer/FromServerTranslator";
import SmallEventWitchServerTranslator from "../../src/packets/fromServer/translators/SmallEventWitchServerTranslator";

function context(): PacketContext {
	return {frontEndOrigin: "test", frontEndSubOrigin: "test", webSocket: {}};
}

describe("witch result over the WebSocket protocol", () => {
	it("registers a dedicated result instead of the generic small-event marker", () => {
		expect(getServerTranslator(SmallEventWitchResultPacket.name)).toMatchObject({
			protoName: SmallEventWitchResultRes.wireName
		});
	});

	it("preserves every consequence needed by the result screen", async () => {
		const source = makePacket(SmallEventWitchResultPacket, {
			ingredientId: "greenApple",
			isIngredient: true,
			forceEffect: false,
			effectId: "sick",
			timeLost: 15,
			lifeLoss: 10,
			outcome: WitchActionOutcomeType.POTION,
			discoveredRecipe: {recipeId: "healthPotion", level: 2, recipeType: "POTION_HEALTH"}
		});

		expect(await SmallEventWitchServerTranslator.translate(context(), source)).toMatchObject({
			ingredientId: "greenApple",
			isIngredient: true,
			forceEffect: false,
			effectId: "sick",
			timeLostMinutes: 15,
			lifeLoss: 10,
			outcome: WitchActionOutcomeType.POTION,
			discoveredRecipe: {recipeId: "healthPotion", level: 2, recipeType: "POTION_HEALTH"}
		});
	});
});