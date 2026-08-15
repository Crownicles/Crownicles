import {
	beforeEach, describe, expect, it, vi
} from "vitest";
import {
	ReactionCollector,
	ReactionCollectorCreationPacket,
	ReactionCollectorRefuseReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import {
	REACTION_COLLECTOR_STOP_REASONS, ReactionCollectorStopPacket
} from "../../../../Lib/src/packets/interaction/ReactionCollectorStopPacket";
import { CrowniclesPacket, PacketContext } from "../../../../Lib/src/packets/CrowniclesPacket";
import { ReactionCollectorInstance } from "../../../src/core/utils/ReactionsCollector";
import { PacketUtils } from "../../../src/core/utils/PacketUtils";

const COLLECTOR_TIME = 5_000;
const PLAYER = "player-keycloak-id";

class TestCollector extends ReactionCollector {
	creationPacket(id: string, endTime: number): ReactionCollectorCreationPacket {
		return {
			id,
			endTime,
			reactions: [this.buildReaction(ReactionCollectorRefuseReaction, {})],
			data: this.buildData(ReactionCollectorRefuseReaction, {})
		};
	}
}

function context(): PacketContext {
	return {
		frontEndOrigin: "test",
		frontEndSubOrigin: "test",
		keycloakId: PLAYER,
		webSocket: {}
	};
}

function stopPacketOf(packets: CrowniclesPacket[]): ReactionCollectorStopPacket {
	const stop = packets.find(packet => packet instanceof ReactionCollectorStopPacket);
	expect(stop).toBeDefined();
	return stop as ReactionCollectorStopPacket;
}

function buildCollector(): {
	collector: ReactionCollectorInstance;
	closingPackets: CrowniclesPacket[];
} {
	const closingPackets: CrowniclesPacket[] = [];
	const collector = new ReactionCollectorInstance(
		new TestCollector(),
		context(),
		{
			time: COLLECTOR_TIME,
			allowedPlayerKeycloakIds: [PLAYER]
		},
		(_collector, packets) => {
			closingPackets.push(...packets);
		}
	);
	collector.build();
	return {
		collector,
		closingPackets
	};
}

describe("ReactionCollectorInstance closing reason", () => {
	beforeEach(() => {
		vi.useFakeTimers();

		// An expiring collector publishes its own packets; the closing callback is what this asserts on
		vi.spyOn(PacketUtils, "sendPackets").mockImplementation(() => {});
		return () => {
			vi.useRealTimers();
			vi.restoreAllMocks();
		};
	});

	it("reports a collector answered by the player as resolved", async () => {
		const {
			collector, closingPackets
		} = buildCollector();

		await collector.react(PLAYER, 0, []);

		expect(stopPacketOf(closingPackets).reason).toBe(REACTION_COLLECTOR_STOP_REASONS.RESOLVED);
	});

	it("reports a collector closed by the flow as resolved", async () => {
		const {
			collector, closingPackets
		} = buildCollector();

		await collector.end([]);

		expect(stopPacketOf(closingPackets).reason).toBe(REACTION_COLLECTOR_STOP_REASONS.RESOLVED);
	});

	it("reports a collector nobody answered in time as expired", async () => {
		const { closingPackets } = buildCollector();

		await vi.advanceTimersByTimeAsync(COLLECTOR_TIME);

		expect(stopPacketOf(closingPackets).reason).toBe(REACTION_COLLECTOR_STOP_REASONS.EXPIRED);
	});
});
