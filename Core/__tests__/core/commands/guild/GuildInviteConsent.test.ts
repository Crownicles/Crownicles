import {afterEach, describe, expect, it, vi} from "vitest";
import {createGuildInvitationCollector} from "../../../../src/core/utils/GuildInvitationCollector";
import {ReactionCollectorController} from "../../../../src/core/utils/ReactionsCollector";
import {ReactionCollectorGuildInvite} from "../../../../../Lib/src/packets/interaction/ReactionCollectorGuildInvite";
import {PacketContext} from "../../../../../Lib/src/packets/CrowniclesPacket";

vi.mock("../../../../src/core/utils/CommandUtils", () => ({commandRequires: () => (_target: unknown, _name: string, descriptor: PropertyDescriptor) => descriptor, CommandUtils: {DISALLOWED_EFFECTS: {NOT_STARTED_OR_DEAD: []}}}));
const CONTEXT: PacketContext = {keycloakId: "author", packetId: "request", frontEndOrigin: "websocket", frontEndSubOrigin: "", webSocket: {}};

describe("guild invitation consent", () => {
	afterEach(() => vi.restoreAllMocks());
	it("rejects the invitation author and restores the invitation for its recipient", async () => {
		const resolved = vi.fn();
		const collector = createGuildInvitationCollector(new ReactionCollectorGuildInvite("Aurore", "invited"), CONTEXT, "invited", resolved);
		collector.build();
		try {
			await collector.react("author", 0, []);
			expect(resolved).not.toHaveBeenCalled();
			expect(collector.getReactionsHistory()).toEqual([]);
			expect(ReactionCollectorController.getCollectorsOfPlayer("invited")).toContain(collector);
			expect(collector.context).not.toHaveProperty("packetId");
			await collector.react("invited", 1, []);
			expect(resolved).toHaveBeenCalledOnce();
			expect(collector.getFirstReaction()?.keycloakId).toBe("invited");
		}
		finally {
			await collector.end([]);
		}
	});
});