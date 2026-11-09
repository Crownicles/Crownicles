import {
	describe, expect, it
} from "vitest";
import { PacketContext } from "../../../Lib/src/packets/CrowniclesPacket";
import { makePacket } from "../../../Lib/src/packets/CrowniclesPacket";
import {
	REACTION_COLLECTOR_STOP_REASONS,
	ReactionCollectorStopPacket,
	ReactionCollectorStopReason
} from "../../../Lib/src/packets/interaction/ReactionCollectorStopPacket";
import { COLLECTOR_STOP_REASONS } from "../../../WsPackets/src/fromServer/common/ReactionCollectorStop";
import ReactionCollectorStopServerTranslator from "../../src/packets/fromServer/translators/ReactionCollectorStopServerTranslator";

const COLLECTOR_ID = "collector-1";

function context(): PacketContext {
	return {
		frontEndOrigin: "test",
		frontEndSubOrigin: "test",
		keycloakId: "player-keycloak-id",
		webSocket: {}
	};
}

function stopPacket(reason: ReactionCollectorStopReason): ReactionCollectorStopPacket {
	return makePacket(ReactionCollectorStopPacket, {
		id: COLLECTOR_ID,
		reason
	});
}

describe("ReactionCollectorStopServerTranslator", () => {
	it.each([
		[REACTION_COLLECTOR_STOP_REASONS.EXPIRED, COLLECTOR_STOP_REASONS.EXPIRED],
		[REACTION_COLLECTOR_STOP_REASONS.RESOLVED, COLLECTOR_STOP_REASONS.RESOLVED]
	])("carries the reason %s to the client as %s", async (backEndReason, protocolReason) => {
		const translated = await ReactionCollectorStopServerTranslator.translate(context(), stopPacket(backEndReason));

		expect(translated.collectorId).toBe(COLLECTOR_ID);
		expect(translated.reason).toBe(protocolReason);
	});

	/*
	 * A client dismisses an interface on this packet, so the identifier has to survive the two
	 * serialisations that separate Core from the app.
	 */
	it("keeps its fields over the wire", async () => {
		const translated = await ReactionCollectorStopServerTranslator.translate(context(), stopPacket(REACTION_COLLECTOR_STOP_REASONS.EXPIRED));

		expect(JSON.parse(JSON.stringify(translated))).toStrictEqual({
			collectorId: COLLECTOR_ID,
			reason: COLLECTOR_STOP_REASONS.EXPIRED
		});
	});
});
