import {
	beforeEach, describe, expect, it, vi
} from "vitest";
import { EventEmitter } from "node:events";

vi.mock("../../../Lib/src/logs/CrowniclesLogger", () => ({
	CrowniclesLogger: {
		warn: vi.fn(),
		error: vi.fn(),
		info: vi.fn(),
		debug: vi.fn(),
		isInitialized: vi.fn(() => true)
	}
}));

vi.mock("../../src/bot/CrowniclesShard", () => ({
	crowniclesClient: {},
	discordConfig: {},
	keycloakConfig: {},
	shardId: 0
}));

import ReactionCollectorHandler from "../../src/packetHandlers/handlers/ReactionCollectorHandlers";
import { DISCORD_MONITORED_CACHES } from "../../src/bot/CrowniclesDiscordMetrics";
import { PacketContext } from "../../../Lib/src/packets/CrowniclesPacket";
import { ReactionCollectorCreationPacket } from "../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { ReactionCollectorStopPacket } from "../../../Lib/src/packets/interaction/ReactionCollectorStopPacket";
import { getExposedCacheSize } from "./cacheSizes";

const COLLECTOR_TYPE = "TestCollectorData";

class FakeCollector extends EventEmitter {
	ended = false;

	stop(): void {
		if (this.ended) {
			return;
		}
		this.ended = true;
		this.emit("end");
	}
}

const context = {} as PacketContext;

async function createCollectors(id: string, collectors: FakeCollector[]): Promise<void> {
	ReactionCollectorHandler.collectorMap.set(COLLECTOR_TYPE, () => Promise.resolve(collectors as never));
	await new ReactionCollectorHandler().collectorCreation(context, {
		id,
		data: { type: COLLECTOR_TYPE }
	} as ReactionCollectorCreationPacket);
}

function stopPacket(id: string): ReactionCollectorStopPacket {
	return { id } as ReactionCollectorStopPacket;
}

describe("ReactionCollectorHandler collectors cache", () => {
	beforeEach(() => {
		ReactionCollectorHandler.collectorMap = new Map();
	});

	it("forgets the collectors once they all ended on their own, even without a stop packet from Core", async () => {
		const first = new FakeCollector();
		const second = new FakeCollector();
		await createCollectors("ended-alone", [first, second]);
		expect(await getExposedCacheSize(DISCORD_MONITORED_CACHES.REACTION_COLLECTORS)).toBe(1);

		first.stop();
		expect(await getExposedCacheSize(DISCORD_MONITORED_CACHES.REACTION_COLLECTORS)).toBe(1);

		second.stop();
		expect(await getExposedCacheSize(DISCORD_MONITORED_CACHES.REACTION_COLLECTORS)).toBe(0);

		await new ReactionCollectorHandler().collectorStop(context, stopPacket("ended-alone"));
		expect(await getExposedCacheSize(DISCORD_MONITORED_CACHES.REACTION_COLLECTORS)).toBe(0);
	});

	it("stops and forgets the collectors when Core sends the stop packet", async () => {
		const collector = new FakeCollector();
		await createCollectors("stopped-by-core", [collector]);
		expect(await getExposedCacheSize(DISCORD_MONITORED_CACHES.REACTION_COLLECTORS)).toBe(1);

		await new ReactionCollectorHandler().collectorStop(context, stopPacket("stopped-by-core"));

		expect(collector.ended).toBe(true);
		expect(await getExposedCacheSize(DISCORD_MONITORED_CACHES.REACTION_COLLECTORS)).toBe(0);
	});
});
