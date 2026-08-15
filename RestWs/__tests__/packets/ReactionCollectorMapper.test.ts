import {
	describe, expect, it
} from "vitest";
import {
	ReactionCollectorCreationPacket,
	ReactionCollectorRefuseReaction
} from "../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import {
	ReactionCollectorDrink,
	ReactionCollectorDrinkReaction
} from "../../../Lib/src/packets/interaction/ReactionCollectorDrink";
import { SupportItemDetails } from "../../../Lib/src/types/SupportItemDetails";
import { MainItemDetails } from "../../../Lib/src/types/MainItemDetails";
import { ItemNature } from "../../../Lib/src/constants/ItemConstants";
import {
	DRINK_COLLECTOR_KIND,
	DRINK_REACTION_KINDS,
	GENERIC_REACTION_KINDS,
	UNKNOWN_COLLECTOR_KIND
} from "../../../WsPackets/src/fromServer/collectors";
import { mapCollectorCreation } from "../../src/packets/fromServer/collectors/ReactionCollectorMapper";
import {
	defineReactionMapping, indexMappings
} from "../../src/packets/fromServer/collectors/CollectorMapping";

const END_TIME = 1_700_000_000_000;

function potion(id: number): SupportItemDetails {
	return {
		id,
		rarity: 3,
		nature: ItemNature.HEALTH,
		power: 12,
		maxPower: 20,
		itemCategory: 2
	};
}

function mainItem(): MainItemDetails {
	const stat = {
		baseValue: 1,
		upgradeValue: 2,
		maxValue: 3
	};
	return {
		id: 7,
		rarity: 4,
		itemCategory: 0,
		itemLevel: 10,
		attack: stat,
		defense: stat,
		speed: stat
	};
}

function taggedAs(type: string, data: object): ReactionCollectorCreationPacket {
	return {
		id: "collector-1",
		endTime: END_TIME,
		data: {
			type,
			data: {}
		},
		reactions: [
			{
				type,
				data
			}
		]
	};
}

describe("mapCollectorCreation", () => {
	it("translates a collector built by the back end without losing its choices", () => {
		const packet = new ReactionCollectorDrink([potion(1), potion(2)]).creationPacket("collector-1", END_TIME, true);

		const mapped = mapCollectorCreation(packet);

		expect(mapped.id).toBe("collector-1");
		expect(mapped.endTime).toBe(END_TIME);
		expect(mapped.data.type).toBe(DRINK_COLLECTOR_KIND);
		expect(mapped.reactions.map(reaction => reaction.type)).toStrictEqual([
			DRINK_REACTION_KINDS.POTION,
			DRINK_REACTION_KINDS.POTION,
			GENERIC_REACTION_KINDS.REFUSE
		]);
	});

	it("keeps the payload of a mapped reaction", () => {
		const packet = new ReactionCollectorDrink([potion(42)]).creationPacket("collector-1", END_TIME, true);

		const [first] = mapCollectorCreation(packet).reactions;

		expect(first.type).toBe(DRINK_REACTION_KINDS.POTION);
		expect(first.type === DRINK_REACTION_KINDS.POTION && first.data.potion).toMatchObject({
			id: 42,
			nature: ItemNature.HEALTH,
			power: 12
		});
	});

	/*
	 * A client answers by index, so a reaction the server does not know how to translate still has to
	 * take up its slot rather than be filtered out.
	 */
	it("keeps the position of an untranslatable reaction", () => {
		const packet = new ReactionCollectorDrink([potion(1)]).creationPacket("collector-1", END_TIME, true);
		packet.reactions.splice(1, 0, {
			type: "ReactionCollectorNotExposedYetReaction",
			data: {}
		});

		const mapped = mapCollectorCreation(packet);

		expect(mapped.reactions).toHaveLength(3);
		expect(mapped.reactions[1].type).toBe(UNKNOWN_COLLECTOR_KIND);
	});

	it("reports the back-end type of an unmapped collector", () => {
		const mapped = mapCollectorCreation(taggedAs("ReactionCollectorSomethingElseData", {}));

		expect(mapped.data).toStrictEqual({
			type: UNKNOWN_COLLECTOR_KIND,
			data: { serverType: "ReactionCollectorSomethingElseData" }
		});
	});

	/*
	 * Collectors built without stating it are main packets, a default the back end leaves implicit by
	 * omitting the field.
	 */
	it("keeps a collector a main packet when the back end omits the flag", () => {
		const packet = taggedAs("ReactionCollectorSomethingElseData", {});
		expect(packet.mainPacket).toBeUndefined();

		expect(mapCollectorCreation(packet).mainPacket).toBe(true);
	});

	/*
	 * The back end types the drunk item as any item, so a payload that is not a potion must degrade
	 * instead of reaching the client under a kind that promises potion fields.
	 */
	it("falls back on the unknown kind when the payload does not fit its kind", () => {
		const packet = taggedAs(ReactionCollectorDrinkReaction.name, { potion: mainItem() });

		const [first] = mapCollectorCreation(packet).reactions;

		expect(first.type).toBe(UNKNOWN_COLLECTOR_KIND);
	});
});

describe("indexMappings", () => {
	it("refuses two mappings claiming the same back-end class", () => {
		expect(() => indexMappings([
			defineReactionMapping(ReactionCollectorRefuseReaction, GENERIC_REACTION_KINDS.REFUSE, () => ({})),
			defineReactionMapping(ReactionCollectorRefuseReaction, GENERIC_REACTION_KINDS.ACCEPT, () => ({}))
		])).toThrow(ReactionCollectorRefuseReaction.name);
	});
});
