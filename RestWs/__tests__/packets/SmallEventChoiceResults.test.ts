import {describe, expect, it} from "vitest";
import {
	SmallEventAltarContributedPacket, SmallEventAltarNoContributionPacket
} from "../../../Lib/src/packets/smallEvents/SmallEventAltarPacket";
import {SmallEventBadPetPacket} from "../../../Lib/src/packets/smallEvents/SmallEventBadPetPacket";
import {SmallEventCartPacket} from "../../../Lib/src/packets/smallEvents/SmallEventCartPacket";
import {SmallEventFightPetPacket} from "../../../Lib/src/packets/smallEvents/SmallEventFightPetPacket";
import {SmallEventGardenerPacket} from "../../../Lib/src/packets/smallEvents/SmallEventGardenerPacket";
import {
	SmallEventGoToPVEIslandAcceptPacket, SmallEventGoToPVEIslandNotEnoughGemsPacket
} from "../../../Lib/src/packets/smallEvents/SmallEventGoToPVEIslandPacket";
import {SmallEventGobletsGamePacket} from "../../../Lib/src/packets/smallEvents/SmallEventGobletsGamePacket";
import {SmallEventInteractOtherPlayersAcceptToGivePoorPacket} from "../../../Lib/src/packets/smallEvents/SmallEventInteractOtherPlayers";
import {SmallEventLimogesPacket} from "../../../Lib/src/packets/smallEvents/SmallEventLimogesPacket";
import {SmallEventPetFoodPacket} from "../../../Lib/src/packets/smallEvents/SmallEventPetFoodPacket";
import {
	SmallEventRecipeShopAcceptedPacket, SmallEventRecipeShopCannotBuyPacket
} from "../../../Lib/src/packets/smallEvents/SmallEventRecipeShopPacket";
import {
	SmallEventShopAcceptPacket, SmallEventShopCannotBuyPacket
} from "../../../Lib/src/packets/smallEvents/SmallEventShopPacket";
import {
	SmallEventEpicItemShopAcceptPacket, SmallEventEpicItemShopCannotBuyPacket
} from "../../../Lib/src/packets/smallEvents/SmallEventEpicItemShopPacket";
import {SmallEventChoiceResultRes} from "../../../WsPackets/src/fromServer/smallEvents/SmallEventChoiceResultRes";
import {getServerTranslator} from "../../src/packets/fromServer/FromServerTranslator";
import "../../src/packets/fromServer/translators/SmallEventChoiceResultServerTranslator";
import {PacketContext} from "../../../Lib/src/packets/CrowniclesPacket";
import {
	GARDENER_INTERACTIONS, PlantConstants, PlantId, SEED_CONDITION_FAILURE
} from "../../../Lib/src/constants/PlantConstants";

const INTERACTIVE_RESULT_PACKETS = [
	SmallEventAltarContributedPacket,
	SmallEventAltarNoContributionPacket,
	SmallEventBadPetPacket,
	SmallEventCartPacket,
	SmallEventFightPetPacket,
	SmallEventGardenerPacket,
	SmallEventGoToPVEIslandAcceptPacket,
	SmallEventGoToPVEIslandNotEnoughGemsPacket,
	SmallEventGobletsGamePacket,
	SmallEventInteractOtherPlayersAcceptToGivePoorPacket,
	SmallEventLimogesPacket,
	SmallEventPetFoodPacket,
	SmallEventRecipeShopAcceptedPacket,
	SmallEventRecipeShopCannotBuyPacket,
	SmallEventShopAcceptPacket,
	SmallEventShopCannotBuyPacket,
	SmallEventEpicItemShopAcceptPacket,
	SmallEventEpicItemShopCannotBuyPacket
];

describe("interactive small-event results", () => {
	it.each(INTERACTIVE_RESULT_PACKETS)("maps $name to a structured result", packet => {
		expect(getServerTranslator(packet.name)).toMatchObject({protoName: SmallEventChoiceResultRes.wireName});
	});

	it("quotes the level a gardener's advice asks for, and tells an answer from a first encounter", async () => {
		const translate = getServerTranslator(SmallEventGardenerPacket.name)!.translatorFunc;
		const advice = await translate({} as PacketContext, {
			interactionName: GARDENER_INTERACTIONS.ADVICE, plantId: PlantId.CRYSTAL_FLOWER, materialId: 0, cost: 0, conditionKey: SEED_CONDITION_FAILURE.NEED_LEVEL
		}) as SmallEventChoiceResultRes;
		const firstEncounter = await translate({} as PacketContext, {
			interactionName: GARDENER_INTERACTIONS.ADVICE, plantId: 0, materialId: 0, cost: 0, conditionKey: SEED_CONDITION_FAILURE.NEED_GARDEN, isFirstEncounter: true
		}) as SmallEventChoiceResultRes;

		expect(advice.result).toMatchObject({requiredLevel: PlantConstants.SEED_LEVEL_REQUIREMENTS[PlantId.CRYSTAL_FLOWER]});
		expect(advice.result).not.toHaveProperty("isFirstEncounter");
		expect(firstEncounter.result).toMatchObject({isFirstEncounter: true});
	});
});
