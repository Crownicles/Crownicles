import {
	describe, expect, it
} from "vitest";
import { ReactionCollectorDrink } from "../../../Lib/src/packets/interaction/ReactionCollectorDrink";
import { SupportItemDetails } from "../../../Lib/src/types/SupportItemDetails";
import { ItemNature } from "../../../Lib/src/constants/ItemConstants";
import { PacketContext } from "../../../Lib/src/packets/CrowniclesPacket";
import { makeFromClientPacket } from "../../../WsPackets/src/MakePackets";
import { ReactionCollectorReactReq } from "../../../WsPackets/src/fromClient/ReactionCollectorReactReq";
import {
	DRINK_REACTION_KINDS, GENERIC_REACTION_KINDS
} from "../../../WsPackets/src/fromServer/collectors";
import { mapCollectorCreation } from "../../src/packets/fromServer/collectors/ReactionCollectorMapper";
import ReactionCollectorReactClientTranslator from "../../src/packets/fromClient/translators/ReactionCollectorReactClientTranslator";

const COLLECTOR_ID = "collector-1";
const END_TIME = 1_700_000_000_000;
const PLAYER = "player-keycloak-id";
const WANTED_POTION_ID = 77;

/**
 * Packets are serialised twice on their way to a client, once over MQTT and once over the socket.
 * Replaying it keeps the test honest about what actually reaches the app: plain objects, no
 * prototypes, no undefined fields.
 * @param value
 */
function overTheWire<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

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

function context(): PacketContext {
	return {
		frontEndOrigin: "test",
		frontEndSubOrigin: "test",
		keycloakId: PLAYER,
		webSocket: {}
	};
}

describe("collector round trip", () => {
	it("carries a choice from the back end to the client and back to the same reaction", async () => {
		const opened = new ReactionCollectorDrink([potion(11), potion(WANTED_POTION_ID)]).creationPacket(COLLECTOR_ID, END_TIME, true);

		const received = overTheWire(mapCollectorCreation(overTheWire(opened)));

		const chosenIndex = received.reactions.findIndex(reaction =>
			reaction.type === DRINK_REACTION_KINDS.POTION && reaction.data.potion.id === WANTED_POTION_ID);
		expect(chosenIndex).toBeGreaterThanOrEqual(0);

		const answer = overTheWire(makeFromClientPacket(ReactionCollectorReactReq, {
			collectorId: received.id,
			reactionIndex: chosenIndex
		}));
		const backToCore = await ReactionCollectorReactClientTranslator.translate(context(), answer);

		expect(backToCore.id).toBe(COLLECTOR_ID);
		expect(backToCore.keycloakId).toBe(PLAYER);

		// What Core will dereference with the index the client sent back
		expect(opened.reactions[backToCore.reactionIndex].data).toMatchObject({ potion: { id: WANTED_POTION_ID } });
	});

	it("lets the client refuse the collector", async () => {
		const opened = new ReactionCollectorDrink([potion(11)]).creationPacket(COLLECTOR_ID, END_TIME, true);

		const received = overTheWire(mapCollectorCreation(overTheWire(opened)));

		const refuseIndex = received.reactions.findIndex(reaction => reaction.type === GENERIC_REACTION_KINDS.REFUSE);
		const backToCore = await ReactionCollectorReactClientTranslator.translate(context(), makeFromClientPacket(ReactionCollectorReactReq, {
			collectorId: received.id,
			reactionIndex: refuseIndex
		}));

		expect(opened.reactions[backToCore.reactionIndex].type).toBe("ReactionCollectorRefuseReaction");
	});
});
