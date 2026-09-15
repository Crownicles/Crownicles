import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import {
	SmallEventAltarContributedPacket, SmallEventAltarNoContributionPacket
} from "../../../../../Lib/src/packets/smallEvents/SmallEventAltarPacket";
import { SmallEventBadPetPacket } from "../../../../../Lib/src/packets/smallEvents/SmallEventBadPetPacket";
import { SmallEventCartPacket } from "../../../../../Lib/src/packets/smallEvents/SmallEventCartPacket";
import { SmallEventFightPetPacket } from "../../../../../Lib/src/packets/smallEvents/SmallEventFightPetPacket";
import { SmallEventGardenerPacket } from "../../../../../Lib/src/packets/smallEvents/SmallEventGardenerPacket";
import {
	SmallEventGoToPVEIslandAcceptPacket, SmallEventGoToPVEIslandNotEnoughGemsPacket
} from "../../../../../Lib/src/packets/smallEvents/SmallEventGoToPVEIslandPacket";
import {
	SmallEventGobletsGameMalus, SmallEventGobletsGamePacket
} from "../../../../../Lib/src/packets/smallEvents/SmallEventGobletsGamePacket";
import { SmallEventInteractOtherPlayersAcceptToGivePoorPacket } from "../../../../../Lib/src/packets/smallEvents/SmallEventInteractOtherPlayers";
import { SmallEventLimogesPacket } from "../../../../../Lib/src/packets/smallEvents/SmallEventLimogesPacket";
import { SmallEventPetFoodPacket } from "../../../../../Lib/src/packets/smallEvents/SmallEventPetFoodPacket";
import {
	SmallEventRecipeShopAcceptedPacket, SmallEventRecipeShopCannotBuyPacket
} from "../../../../../Lib/src/packets/smallEvents/SmallEventRecipeShopPacket";
import {
	SmallEventShopAcceptPacket, SmallEventShopCannotBuyPacket
} from "../../../../../Lib/src/packets/smallEvents/SmallEventShopPacket";
import {
	SmallEventEpicItemShopAcceptPacket, SmallEventEpicItemShopCannotBuyPacket
} from "../../../../../Lib/src/packets/smallEvents/SmallEventEpicItemShopPacket";
import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";
import {
	SmallEventChoiceResult, SmallEventChoiceResultRes
} from "../../../../../WsPackets/src/fromServer/smallEvents/SmallEventChoiceResultRes";
import {
	SMALL_EVENT_BAD_PET_ACTION_IDS, SMALL_EVENT_GOBLET_IDS,
	SmallEventBadPetActionId, SmallEventGobletId
} from "../../../../../WsPackets/src/fromServer/collectors";
import { PetSex } from "../../../../../WsPackets/src/objects/OwnedPet";
import { fromServerTranslator } from "../FromServerTranslator";

function makeResult(result: SmallEventChoiceResult): Promise<SmallEventChoiceResultRes> {
	return asyncMakeFromServerPacket(SmallEventChoiceResultRes, { result });
}

type GobletsResult = Extract<SmallEventChoiceResult, { event: "goblets" }>;
type PetFoodResult = Extract<SmallEventChoiceResult, { event: "petFood" }>;

function badPetActionId(actionId: string): SmallEventBadPetActionId {
	if (Object.values(SMALL_EVENT_BAD_PET_ACTION_IDS).includes(actionId as SmallEventBadPetActionId)) {
		return actionId as SmallEventBadPetActionId;
	}
	throw new Error(`Unsupported bad pet action: ${actionId}`);
}

function petSex(sex: string): PetSex {
	if (sex === "m" || sex === "f") {
		return sex;
	}
	throw new Error(`Unsupported pet sex: ${sex}`);
}

function gobletId(goblet: string): SmallEventGobletId {
	if (Object.values(SMALL_EVENT_GOBLET_IDS).includes(goblet as SmallEventGobletId)) {
		return goblet as SmallEventGobletId;
	}
	throw new Error(`Unsupported goblet: ${goblet}`);
}

function gobletsMalus(malus: SmallEventGobletsGameMalus): GobletsResult["malus"] {
	return malus;
}

function petFoodOutcome(outcome: string): PetFoodResult["outcome"] {
	switch (outcome) {
		case "found_by_player":
		case "found_by_pet":
		case "found_anyway":
		case "nothing":
		case "pet_failed":
		case "player_failed":
			return outcome;
		default:
			throw new Error(`Unsupported pet food outcome: ${outcome}`);
	}
}

export default class SmallEventChoiceResultServerTranslator {
	@fromServerTranslator(SmallEventAltarNoContributionPacket, SmallEventChoiceResultRes)
	public static altarNotContributed(_context: PacketContext, packet: SmallEventAltarNoContributionPacket): Promise<SmallEventChoiceResultRes> {
		return makeResult({
			event: "altar", outcome: "notContributed", amount: packet.amount, current: packet.newPoolAmount, threshold: packet.poolThreshold, canAfford: packet.hasEnoughMoney
		});
	}

	@fromServerTranslator(SmallEventAltarContributedPacket, SmallEventChoiceResultRes)
	public static altarContributed(_context: PacketContext, packet: SmallEventAltarContributedPacket): Promise<SmallEventChoiceResultRes> {
		return makeResult({
			event: "altar", outcome: "contributed", amount: packet.amount, current: packet.newPoolAmount, threshold: packet.poolThreshold, blessingTriggered: packet.blessingTriggered, blessingType: packet.blessingType, bonusGems: packet.bonusGems, bonusItemGiven: packet.bonusItemGiven, badgeAwarded: packet.badgeAwarded
		});
	}

	@fromServerTranslator(SmallEventBadPetPacket, SmallEventChoiceResultRes)
	public static badPet(_context: PacketContext, packet: SmallEventBadPetPacket): Promise<SmallEventChoiceResultRes> {
		return makeResult({
			event: "badPet", outcome: "resolved", loveLost: packet.loveLost, actionId: badPetActionId(packet.interactionType), petId: packet.petId, sex: petSex(packet.sex), ...packet.petNickname === undefined ? {} : { petNickname: packet.petNickname }
		});
	}

	@fromServerTranslator(SmallEventCartPacket, SmallEventChoiceResultRes)
	public static cart(_context: PacketContext, packet: SmallEventCartPacket): Promise<SmallEventChoiceResultRes> {
		return makeResult({
			event: "cart", outcome: "resolved", accepted: packet.travelDone.isAccepted, canAfford: packet.travelDone.hasEnoughMoney, isScam: packet.isScam, pointsWon: packet.pointsWon
		});
	}

	@fromServerTranslator(SmallEventFightPetPacket, SmallEventChoiceResultRes)
	public static fightPet(_context: PacketContext, packet: SmallEventFightPetPacket): Promise<SmallEventChoiceResultRes> {
		return makeResult({
			event: "fightPet", outcome: packet.isSuccess ? "success" : "failure", actionId: packet.fightPetActionId, isFemale: packet.isFemale
		});
	}

	@fromServerTranslator(SmallEventGardenerPacket, SmallEventChoiceResultRes)
	public static gardener(_context: PacketContext, packet: SmallEventGardenerPacket): Promise<SmallEventChoiceResultRes> {
		return makeResult({
			event: "gardener", outcome: "resolved", interactionName: packet.interactionName, plantId: packet.plantId, materialId: packet.materialId, cost: packet.cost
		});
	}

	@fromServerTranslator(SmallEventGoToPVEIslandAcceptPacket, SmallEventChoiceResultRes)
	public static pveIslandAccepted(_context: PacketContext, packet: SmallEventGoToPVEIslandAcceptPacket): Promise<SmallEventChoiceResultRes> {
		return makeResult({
			event: "pveIsland", outcome: "accepted", alone: packet.alone, pointsWon: packet.pointsWon
		});
	}

	@fromServerTranslator(SmallEventGoToPVEIslandNotEnoughGemsPacket, SmallEventChoiceResultRes)
	public static pveIslandCannotBuy(_context: PacketContext, _packet: SmallEventGoToPVEIslandNotEnoughGemsPacket): Promise<SmallEventChoiceResultRes> {
		return makeResult({
			event: "pveIsland", outcome: "notEnoughGems"
		});
	}

	@fromServerTranslator(SmallEventGobletsGamePacket, SmallEventChoiceResultRes)
	public static goblets(_context: PacketContext, packet: SmallEventGobletsGamePacket): Promise<SmallEventChoiceResultRes> {
		return makeResult({
			event: "goblets", outcome: "resolved", malus: gobletsMalus(packet.malus), goblet: gobletId(packet.goblet), value: packet.value
		});
	}

	@fromServerTranslator(SmallEventInteractOtherPlayersAcceptToGivePoorPacket, SmallEventChoiceResultRes)
	public static interactPoorDonated(_context: PacketContext, _packet: SmallEventInteractOtherPlayersAcceptToGivePoorPacket): Promise<SmallEventChoiceResultRes> {
		return makeResult({
			event: "interactPoor", outcome: "donated"
		});
	}

	@fromServerTranslator(SmallEventLimogesPacket, SmallEventChoiceResultRes)
	public static limoges(_context: PacketContext, packet: SmallEventLimogesPacket): Promise<SmallEventChoiceResultRes> {
		return makeResult({
			event: "limoges", outcome: packet.isSuccess ? "success" : "failure", ...packet.reward === undefined ? {} : { reward: { ...packet.reward } }, ...packet.penalty === undefined ? {} : { penalty: { ...packet.penalty } }
		});
	}

	@fromServerTranslator(SmallEventPetFoodPacket, SmallEventChoiceResultRes)
	public static petFood(_context: PacketContext, packet: SmallEventPetFoodPacket): Promise<SmallEventChoiceResultRes> {
		return makeResult({
			event: "petFood", outcome: petFoodOutcome(packet.outcome), loveChange: packet.loveChange, ...packet.timeLost === undefined ? {} : { timeLostMinutes: packet.timeLost }
		});
	}

	@fromServerTranslator(SmallEventRecipeShopAcceptedPacket, SmallEventChoiceResultRes)
	public static recipeAccepted(_context: PacketContext, packet: SmallEventRecipeShopAcceptedPacket): Promise<SmallEventChoiceResultRes> {
		return makeResult({
			event: "recipeShop", outcome: "accepted", recipe: packet.recipe, recipeCost: packet.recipeCost
		});
	}

	@fromServerTranslator(SmallEventRecipeShopCannotBuyPacket, SmallEventChoiceResultRes)
	public static recipeCannotBuy(_context: PacketContext, _packet: SmallEventRecipeShopCannotBuyPacket): Promise<SmallEventChoiceResultRes> {
		return makeResult({
			event: "recipeShop", outcome: "cannotBuy"
		});
	}

	@fromServerTranslator(SmallEventShopAcceptPacket, SmallEventChoiceResultRes)
	public static shopPurchased(_context: PacketContext, _packet: SmallEventShopAcceptPacket): Promise<SmallEventChoiceResultRes> {
		return makeResult({
			event: "shop", outcome: "purchased"
		});
	}

	@fromServerTranslator(SmallEventShopCannotBuyPacket, SmallEventChoiceResultRes)
	public static shopCannotBuy(_context: PacketContext, _packet: SmallEventShopCannotBuyPacket): Promise<SmallEventChoiceResultRes> {
		return makeResult({
			event: "shop", outcome: "cannotBuy"
		});
	}

	@fromServerTranslator(SmallEventEpicItemShopAcceptPacket, SmallEventChoiceResultRes)
	public static epicShopPurchased(_context: PacketContext, _packet: SmallEventEpicItemShopAcceptPacket): Promise<SmallEventChoiceResultRes> {
		return makeResult({
			event: "epicShop", outcome: "purchased"
		});
	}

	@fromServerTranslator(SmallEventEpicItemShopCannotBuyPacket, SmallEventChoiceResultRes)
	public static epicShopCannotBuy(_context: PacketContext, _packet: SmallEventEpicItemShopCannotBuyPacket): Promise<SmallEventChoiceResultRes> {
		return makeResult({
			event: "epicShop", outcome: "cannotBuy"
		});
	}
}
