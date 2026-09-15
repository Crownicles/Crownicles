import {
	describe, expect, it
} from "vitest";
import { PacketContext } from "../../../Lib/src/packets/CrowniclesPacket";
import { makeFromClientPacket } from "../../../WsPackets/src/MakePackets";
import { ReactionCollectorReactReq } from "../../../WsPackets/src/fromClient/ReactionCollectorReactReq";
import ReactionCollectorReactClientTranslator from "../../src/packets/fromClient/translators/ReactionCollectorReactClientTranslator";
import { InvalidClientPacketError } from "../../src/packets/fromClient/InvalidClientPacketError";

const AUTHENTICATED_PLAYER = "authenticated-player";

function contextOf(keycloakId?: string): PacketContext {
	return {
		frontEndOrigin: "test",
		frontEndSubOrigin: "test",
		keycloakId,
		webSocket: {}
	};
}

function reactionOf(reactionIndex: number, collectorId = "collector-1"): ReactionCollectorReactReq {
	return makeFromClientPacket(ReactionCollectorReactReq, {
		collectorId,
		reactionIndex
	});
}

describe("ReactionCollectorReactClientTranslator", () => {
	it("attributes the reaction to the authenticated connection", async () => {
		const translated = await ReactionCollectorReactClientTranslator.translate(contextOf(AUTHENTICATED_PLAYER), reactionOf(2, "collector-42"));

		expect(translated.keycloakId).toBe(AUTHENTICATED_PLAYER);
		expect(translated.id).toBe("collector-42");
		expect(translated.reactionIndex).toBe(2);
	});

	it("ignores a player identifier smuggled in the client packet", async () => {
		const forged = Object.assign(reactionOf(0), { keycloakId: "someone-else" });

		const translated = await ReactionCollectorReactClientTranslator.translate(contextOf(AUTHENTICATED_PLAYER), forged);

		expect(translated.keycloakId).toBe(AUTHENTICATED_PLAYER);
	});

	it("rejects a reaction sent over an unauthenticated connection", async () => {
		await expect(ReactionCollectorReactClientTranslator.translate(contextOf(undefined), reactionOf(0)))
			.rejects.toThrow(InvalidClientPacketError);
	});

	/*
	 * Core only bounds-checks the index, so anything that is not a whole number would pass its filter
	 * and then dereference a reaction that does not exist.
	 */
	it.each([
		1.5,
		-1,
		Number.NaN,
		Number.POSITIVE_INFINITY
	])("rejects the non-indexable value %p", async reactionIndex => {
		await expect(ReactionCollectorReactClientTranslator.translate(contextOf(AUTHENTICATED_PLAYER), reactionOf(reactionIndex)))
			.rejects.toThrow(InvalidClientPacketError);
	});

	it("rejects a reaction that targets no collector", async () => {
		const withoutCollector = makeFromClientPacket(ReactionCollectorReactReq, { reactionIndex: 0 } as ReactionCollectorReactReq);

		await expect(ReactionCollectorReactClientTranslator.translate(contextOf(AUTHENTICATED_PLAYER), withoutCollector))
			.rejects.toThrow(InvalidClientPacketError);
	});
});
