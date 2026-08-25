import {
	describe, expect, it
} from "vitest";
import {
	ReactionCollectorCreationPacket
} from "../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import {
	ReactionCollectorItemAccept
} from "../../../Lib/src/packets/interaction/ReactionCollectorItemAccept";
import {
	ReactionCollectorItemChoice,
	ReactionCollectorItemChoiceData,
	ReactionCollectorItemChoiceItemReaction
} from "../../../Lib/src/packets/interaction/ReactionCollectorItemChoice";
import {
	ReactionCollectorAltar, ReactionCollectorAltarContributeReaction
} from "../../../Lib/src/packets/interaction/ReactionCollectorAltar";
import {
	ReactionCollectorBadPetReaction, ReactionCollectorBadPetSmallEvent
} from "../../../Lib/src/packets/interaction/ReactionCollectorBadPetSmallEvent";
import {ReactionCollectorGardener} from "../../../Lib/src/packets/interaction/ReactionCollectorGardener";
import {
	ReactionCollectorGobletsGame
} from "../../../Lib/src/packets/interaction/ReactionCollectorGobletsGame";
import {ReactionCollectorInteractOtherPlayersPoor} from "../../../Lib/src/packets/interaction/ReactionCollectorInteractOtherPlayers";
import {ReactionCollectorLimoges} from "../../../Lib/src/packets/interaction/ReactionCollectorLimoges";
import {ReactionCollectorLottery} from "../../../Lib/src/packets/interaction/ReactionCollectorLottery";
import {ReactionCollectorPetFoodSmallEvent} from "../../../Lib/src/packets/interaction/ReactionCollectorPetFoodSmallEvent";
import {ReactionCollectorWitch} from "../../../Lib/src/packets/interaction/ReactionCollectorWitch";
import {PlantId} from "../../../Lib/src/constants/PlantConstants";
import {
	GENERIC_REACTION_KINDS, ITEM_DATA_KINDS, ITEM_REACTION_KINDS,
	SMALL_EVENT_DATA_KINDS, SMALL_EVENT_REACTION_KINDS
} from "../../../WsPackets/src/fromServer/collectors";
import {mapCollectorCreation} from "../../src/packets/fromServer/collectors/ReactionCollectorMapper";

const END_TIME = 1_700_000_000_000;

function map(packet: ReactionCollectorCreationPacket): ReturnType<typeof mapCollectorCreation> {
	return mapCollectorCreation(packet);
}

describe("small-event collector mappings", () => {
	it("maps every non-merchant small-event data payload", () => {
		const badPetReaction = new ReactionCollectorBadPetReaction();
		badPetReaction.id = "plead";

		const packets: [string, ReactionCollectorCreationPacket][] = [
			[SMALL_EVENT_DATA_KINDS.ALTAR, new ReactionCollectorAltar([1, 5], 10, 100).creationPacket("altar", END_TIME)],
			[SMALL_EVENT_DATA_KINDS.BAD_PET, new ReactionCollectorBadPetSmallEvent(2, "m", "Milo", [badPetReaction]).creationPacket("bad-pet", END_TIME)],
			[SMALL_EVENT_DATA_KINDS.GARDENER, new ReactionCollectorGardener(PlantId.COMMON_HERB, 10, "paid", true).creationPacket("gardener", END_TIME)],
			[SMALL_EVENT_DATA_KINDS.GOBLETS_GAME, new ReactionCollectorGobletsGame().creationPacket("goblets", END_TIME)],
			[SMALL_EVENT_DATA_KINDS.INTERACT_OTHER_PLAYERS, new ReactionCollectorInteractOtherPlayersPoor("other-player", 4).creationPacket("interact", END_TIME)],
			[SMALL_EVENT_DATA_KINDS.LIMOGES, new ReactionCollectorLimoges("question-1").creationPacket("limoges", END_TIME)],
			[SMALL_EVENT_DATA_KINDS.LOTTERY, new ReactionCollectorLottery().creationPacket("lottery", END_TIME)],
			[SMALL_EVENT_DATA_KINDS.PET_FOOD, new ReactionCollectorPetFoodSmallEvent("meat", "f").creationPacket("pet-food", END_TIME)],
			[SMALL_EVENT_DATA_KINDS.WITCH, new ReactionCollectorWitch([{id: "advice"}]).creationPacket("witch", END_TIME)]
		];

		for (const [expectedType, packet] of packets) {
			expect(map(packet).data.type).toBe(expectedType);
		}
	});

	it("keeps altar contributions in the positions sent by Core", () => {
		const packet = new ReactionCollectorAltar([1, 5], 10, 100).creationPacket("altar", END_TIME);
		const mapped = map(packet);

		expect(mapped.reactions.map(reaction => reaction.type)).toStrictEqual([
			SMALL_EVENT_REACTION_KINDS.ALTAR_CONTRIBUTE,
			SMALL_EVENT_REACTION_KINDS.ALTAR_CONTRIBUTE,
			GENERIC_REACTION_KINDS.REFUSE
		]);
		expect(mapped.reactions[1]).toStrictEqual({
			type: SMALL_EVENT_REACTION_KINDS.ALTAR_CONTRIBUTE,
			data: {amount: 5}
		});
	});

	it("keeps family-specific choices instead of collapsing them to unknown", () => {
		const badPetReaction = new ReactionCollectorBadPetReaction();
		badPetReaction.id = "plead";
		const badPet = map(new ReactionCollectorBadPetSmallEvent(2, "m", undefined, [badPetReaction]).creationPacket("bad-pet", END_TIME));
		const goblets = map(new ReactionCollectorGobletsGame().creationPacket("goblets", END_TIME));
		const witch = map(new ReactionCollectorWitch([{id: "ingredient"}]).creationPacket("witch", END_TIME));

		expect(badPet.reactions[0]).toStrictEqual({
			type: SMALL_EVENT_REACTION_KINDS.BAD_PET,
			data: {id: "plead"}
		});
		expect(goblets.reactions[1]).toStrictEqual({
			type: SMALL_EVENT_REACTION_KINDS.GOBLETS_GAME,
			data: {id: "biggest", strategy: "safe"}
		});
		expect(witch.reactions[0]).toStrictEqual({
			type: SMALL_EVENT_REACTION_KINDS.WITCH,
			data: {id: "ingredient"}
		});
	});

	it("maps item reward collectors without changing their choice order", () => {
		const itemDetails = {
			id: 7,
			rarity: 1,
			itemCategory: 0,
			itemLevel: 2,
			attack: {baseValue: 1, upgradeValue: 2, maxValue: 3},
			defense: {baseValue: 1, upgradeValue: 2, maxValue: 3},
			speed: {baseValue: 1, upgradeValue: 2, maxValue: 3}
		};
		const itemChoiceData = new ReactionCollectorItemChoiceData();
		itemChoiceData.item = {id: 8, category: 0};
		const itemReaction = new ReactionCollectorItemChoiceItemReaction();
		itemReaction.slot = 2;
		itemReaction.itemWithDetails = itemDetails;

		const choice = map(new ReactionCollectorItemChoice(
			itemChoiceData,
			[itemReaction],
			true
		).creationPacket("item-choice", END_TIME));
		const accept = map(new ReactionCollectorItemAccept(itemDetails, true).creationPacket("item-accept", END_TIME));

		expect(choice.data).toStrictEqual({
			type: ITEM_DATA_KINDS.CHOICE,
			data: {item: {id: 8, category: 0}}
		});
		expect(choice.reactions.map(reaction => reaction.type)).toStrictEqual([
			ITEM_REACTION_KINDS.CHOICE_ITEM,
			ITEM_REACTION_KINDS.CHOICE_DRINK_POTION,
			ITEM_REACTION_KINDS.CHOICE_REFUSE
		]);
		expect(choice.reactions[0]).toStrictEqual({
			type: ITEM_REACTION_KINDS.CHOICE_ITEM,
			data: {slot: 2, itemWithDetails: itemDetails}
		});
		expect(accept.data).toStrictEqual({
			type: ITEM_DATA_KINDS.ACCEPT,
			data: {itemWithDetails: itemDetails}
		});
		expect(accept.reactions.map(reaction => reaction.type)).toStrictEqual([
			GENERIC_REACTION_KINDS.ACCEPT,
			ITEM_REACTION_KINDS.ACCEPT_DRINK_POTION,
			GENERIC_REACTION_KINDS.REFUSE
		]);
	});
});