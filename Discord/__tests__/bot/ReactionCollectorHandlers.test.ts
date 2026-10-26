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
import { ReactionCollectorResetTimerPacketRes } from "../../../Lib/src/packets/interaction/ReactionCollectorResetTimer";
import { DiscordCollectorUtils } from "../../src/utils/DiscordCollectorUtils";
import { ReactionCollector } from "discord.js";
import { getExposedCacheSize } from "./cacheSizes";
import {
	fakeCollectorMessage, wait
} from "./fakeCollectorMessage";

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

async function createLifecycleCollector(id: string, endTime: number): Promise<ReactionCollector> {
	let lifecycleCollector!: ReactionCollector;
	ReactionCollectorHandler.collectorMap.set(COLLECTOR_TYPE, (_context, packet) => {
		lifecycleCollector = DiscordCollectorUtils.createCoreLifecycleCollector(fakeCollectorMessage(), packet);
		return Promise.resolve([lifecycleCollector]);
	});
	await new ReactionCollectorHandler().collectorCreation(context, {
		id,
		endTime,
		data: { type: COLLECTOR_TYPE }
	} as ReactionCollectorCreationPacket);
	return lifecycleCollector;
}

describe("Core lifecycle collectors of the nested menus", () => {
	const DEADLINE_MS = 100;

	beforeEach(() => {
		ReactionCollectorHandler.collectorMap = new Map();
	});

	it("end at Core's deadline and leave the cache when Core's stop packet is lost", async () => {
		const collector = await createLifecycleCollector("lost-stop", Date.now() + DEADLINE_MS);
		expect(await getExposedCacheSize(DISCORD_MONITORED_CACHES.REACTION_COLLECTORS)).toBe(1);

		await wait(DEADLINE_MS * 2);

		expect(collector.ended).toBe(true);
		expect(await getExposedCacheSize(DISCORD_MONITORED_CACHES.REACTION_COLLECTORS)).toBe(0);
	});

	it("follow the deadline pushed back by Core's timer resets", async () => {
		const collector = await createLifecycleCollector("reset-then-lost-stop", Date.now() + DEADLINE_MS);

		await wait(DEADLINE_MS / 2);
		await new ReactionCollectorHandler().collectorResetTimer(context, {
			reactionCollectorId: "reset-then-lost-stop",
			endTime: Date.now() + DEADLINE_MS * 3
		} as ReactionCollectorResetTimerPacketRes);

		await wait(DEADLINE_MS);
		expect(collector.ended).toBe(false);
		expect(await getExposedCacheSize(DISCORD_MONITORED_CACHES.REACTION_COLLECTORS)).toBe(1);

		await wait(DEADLINE_MS * 3);
		expect(collector.ended).toBe(true);
		expect(await getExposedCacheSize(DISCORD_MONITORED_CACHES.REACTION_COLLECTORS)).toBe(0);
	});

	it("still get a deadline when the creation packet arrives after Core's deadline", async () => {
		const collector = await createLifecycleCollector("late-creation", Date.now());

		await wait(DEADLINE_MS / 2);

		expect(collector.ended).toBe(true);
		expect(await getExposedCacheSize(DISCORD_MONITORED_CACHES.REACTION_COLLECTORS)).toBe(0);
	});
});
