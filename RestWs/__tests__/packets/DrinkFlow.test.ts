import {
	describe, expect, it
} from "vitest";
import {
	makePacket, PacketContext
} from "../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandDrinkCancelDrink,
	CommandDrinkNoAvailablePotion,
	CommandDrinkPacketReq,
	CommandDrinkPacketRes
} from "../../../Lib/src/packets/commands/CommandDrinkPacket";
import { ReactionCollectorDrink } from "../../../Lib/src/packets/interaction/ReactionCollectorDrink";
import {
	REACTION_COLLECTOR_STOP_REASONS, ReactionCollectorStopPacket
} from "../../../Lib/src/packets/interaction/ReactionCollectorStopPacket";
import { ItemNature } from "../../../Lib/src/constants/ItemConstants";
import { SupportItemDetails } from "../../../Lib/src/types/SupportItemDetails";
import { makeFromClientPacket } from "../../../WsPackets/src/MakePackets";
import { DrinkReq } from "../../../WsPackets/src/fromClient/DrinkReq";
import { ReactionCollectorReactReq } from "../../../WsPackets/src/fromClient/ReactionCollectorReactReq";
import {
	DRINK_REACTION_KINDS, GENERIC_REACTION_KINDS
} from "../../../WsPackets/src/fromServer/collectors";
import { COLLECTOR_STOP_REASONS } from "../../../WsPackets/src/fromServer/common/ReactionCollectorStop";
import DrinkCommandClientTranslator from "../../src/packets/fromClient/translators/DrinkCommandClientTranslator";
import DrinkCommandServerTranslator from "../../src/packets/fromServer/translators/DrinkCommandServerTranslator";
import ReactionCollectorReactClientTranslator from "../../src/packets/fromClient/translators/ReactionCollectorReactClientTranslator";
import ReactionCollectorStopServerTranslator from "../../src/packets/fromServer/translators/ReactionCollectorStopServerTranslator";
import { mapCollectorCreation } from "../../src/packets/fromServer/collectors/ReactionCollectorMapper";

const COLLECTOR_ID = "drink-collector";
const END_TIME = 1_700_000_000_000;
const PLAYER = "player-keycloak-id";
const WANTED_POTION_ID = 77;

function overTheWire<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

function potion(id: number): SupportItemDetails {
	return {
		id,
		rarity: 3,
		nature: ItemNature.HEALTH,
		power: 30,
		maxPower: 30,
		itemCategory: 2
	};
}

function context(): PacketContext {
	return {
		frontEndOrigin: "test",
		frontEndSubOrigin: "test",
		keycloakId: PLAYER,
		webSocket: {}
	};
}

function openedCollector(): ReturnType<ReactionCollectorDrink["creationPacket"]> {
	return new ReactionCollectorDrink([potion(11), potion(WANTED_POTION_ID)]).creationPacket(COLLECTOR_ID, END_TIME, true);
}

async function answer(reactionIndex: number): Promise<number> {
	const translated = await ReactionCollectorReactClientTranslator.translate(context(), makeFromClientPacket(ReactionCollectorReactReq, {
		collectorId: COLLECTOR_ID,
		reactionIndex
	}));
	return translated.reactionIndex;
}

describe("/drink over the WebSocket protocol", () => {
	it("turns a client request into the command the back end expects", async () => {
		const translated = await DrinkCommandClientTranslator.translate(context(), makeFromClientPacket(DrinkReq, {}));

		expect(translated).toBeInstanceOf(CommandDrinkPacketReq);
	});

	it("takes the player from the offered potions to the applied effect", async () => {
		const opened = openedCollector();
		const offered = overTheWire(mapCollectorCreation(overTheWire(opened)));

		const chosenIndex = offered.reactions.findIndex(reaction =>
			reaction.type === DRINK_REACTION_KINDS.POTION && reaction.data.potion.id === WANTED_POTION_ID);
		const indexReachingCore = await answer(chosenIndex);

		// The potion Core will consume must be the one the client saw at that position
		expect(opened.reactions[indexReachingCore].data).toMatchObject({ potion: { id: WANTED_POTION_ID } });

		const effect = await DrinkCommandServerTranslator.translate(context(), makePacket(CommandDrinkPacketRes, {
			value: 30,
			itemNature: ItemNature.HEALTH
		}));

		expect(overTheWire(effect)).toStrictEqual({
			value: 30,
			itemNature: ItemNature.HEALTH
		});
	});

	it("sends the refusal back as a cancelled drink", async () => {
		const opened = openedCollector();
		const offered = overTheWire(mapCollectorCreation(overTheWire(opened)));

		const refuseIndex = offered.reactions.findIndex(reaction => reaction.type === GENERIC_REACTION_KINDS.REFUSE);
		const indexReachingCore = await answer(refuseIndex);

		expect(opened.reactions[indexReachingCore].type).toBe("ReactionCollectorRefuseReaction");

		const cancelled = await DrinkCommandServerTranslator.translateCancel(context(), makePacket(CommandDrinkCancelDrink, {}));

		expect(cancelled).toBeDefined();
	});

	it("tells the client that the collector expired", async () => {
		const stop = await ReactionCollectorStopServerTranslator.translate(context(), makePacket(ReactionCollectorStopPacket, {
			id: COLLECTOR_ID,
			reason: REACTION_COLLECTOR_STOP_REASONS.EXPIRED
		}));

		expect(stop.collectorId).toBe(COLLECTOR_ID);
		expect(stop.reason).toBe(COLLECTOR_STOP_REASONS.EXPIRED);
	});

	it("tells the client when no potion can be drunk", async () => {
		const answered = await DrinkCommandServerTranslator.translateNoAvailablePotion(context(), makePacket(CommandDrinkNoAvailablePotion, {}));

		expect(answered).toBeDefined();
	});
});
