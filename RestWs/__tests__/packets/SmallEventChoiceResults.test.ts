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
});
