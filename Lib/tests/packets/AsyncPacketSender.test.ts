import {
	describe, it, expect, vi, afterEach
} from "vitest";
import { readdirSync } from "fs";
import { join } from "path";
import {
	AsyncPacketSender, NOTIFICATION_PACKET_NAMES
} from "../../src/packets/AsyncPacketSender";
import {
	CrowniclesPacket, PacketContext
} from "../../src/packets/CrowniclesPacket";
import { MissionsCompletedPacket } from "../../src/packets/events/MissionsCompletedPacket";

/**
 * Contract test for {@link AsyncPacketSender}.
 *
 * Guards the invariant that broke in issue #4380: a pending request callback
 * must NOT be fulfilled by a side-effect broadcast (mission completion, pet
 * reward…) that happens to share the request's packetId. If it were, the first
 * broadcast in the batch would consume (and often mis-handle as a failure) the
 * request, and the real response would fall through to the listener lookup and
 * error out.
 */

class TestPacketSender extends AsyncPacketSender {
	public readonly sent: CrowniclesPacket[] = [];

	protected sendPacket(_context: PacketContext, packet: CrowniclesPacket): Promise<void> {
		this.sent.push(packet);
		return Promise.resolve();
	}
}

class FailingPacketSender extends AsyncPacketSender {
	protected sendPacket(): Promise<void> {
		return Promise.reject(new Error("send failed"));
	}
}

class ThrowingPacketSender extends AsyncPacketSender {
	protected sendPacket(): Promise<void> {
		throw new Error("synchronous send failed");
	}
}

// Minimal stand-in response packet (only its class name matters here).
class FooRes extends CrowniclesPacket {}

function makeContext(): PacketContext {
	return {
		frontEndOrigin: "test",
		frontEndSubOrigin: "test"
	};
}

describe("AsyncPacketSender.handleResponse", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("fulfils the callback with a normal response", async () => {
		const sender = new TestPacketSender();
		const ctx = makeContext();
		const received: string[] = [];

		await sender.sendPacketAndHandleResponse(ctx, new FooRes(), (_c, name) => {
			received.push(name);
		});

		const consumed = await sender.handleResponse(ctx, FooRes.name, new FooRes());
		expect(consumed).toBe(true);
		expect(received).toEqual([FooRes.name]);
	});

	it("does not let a notification packet fulfil a pending request, and keeps waiting for the real response", async () => {
		const sender = new TestPacketSender();
		const ctx = makeContext();
		const received: string[] = [];

		await sender.sendPacketAndHandleResponse(ctx, new FooRes(), (_c, name) => {
			received.push(name);
		});

		// A mission-completed broadcast arrives first in the batch.
		const notificationConsumed = await sender.handleResponse(ctx, MissionsCompletedPacket.name, new FooRes());
		expect(notificationConsumed).toBe(false);
		expect(received).toEqual([]);

		// The actual response arrives afterwards and still reaches the callback.
		const responseConsumed = await sender.handleResponse(ctx, FooRes.name, new FooRes());
		expect(responseConsumed).toBe(true);
		expect(received).toEqual([FooRes.name]);
	});

	it("returns false when there is no pending request for the context", async () => {
		const sender = new TestPacketSender();
		const ctx = makeContext();
		ctx.packetId = "unknown-id";

		const consumed = await sender.handleResponse(ctx, FooRes.name, new FooRes());
		expect(consumed).toBe(false);
	});

	it("runs the timeout callback and evicts an unanswered request", async () => {
		vi.useFakeTimers();
		const sender = new TestPacketSender();
		const ctx = makeContext();
		const onTimeout = vi.fn();
		await sender.sendPacketAndHandleResponse(ctx, new FooRes(), vi.fn(), {
			timeoutMs: 100,
			onTimeout
		});

		await vi.advanceTimersByTimeAsync(100);

		expect(onTimeout).toHaveBeenCalledOnce();
		await expect(sender.handleResponse(ctx, FooRes.name, new FooRes())).resolves.toBe(false);
	});

	it("evicts a request when sending fails", async () => {
		const sender = new FailingPacketSender();
		const ctx = makeContext();

		await expect(sender.sendPacketAndHandleResponse(ctx, new FooRes(), vi.fn())).rejects.toThrow("send failed");
		await expect(sender.handleResponse(ctx, FooRes.name, new FooRes())).resolves.toBe(false);
	});

	it("evicts a request when sending throws synchronously", async () => {
		const sender = new ThrowingPacketSender();
		const ctx = makeContext();

		await expect(sender.sendPacketAndHandleResponse(ctx, new FooRes(), vi.fn())).rejects.toThrow("synchronous send failed");
		await expect(sender.handleResponse(ctx, FooRes.name, new FooRes())).resolves.toBe(false);
	});
});

/**
 * Completeness guard: every packet under `src/packets/events` is a broadcast
 * with a dedicated front-end listener and must never fulfil a request callback.
 * If a new event packet is added but forgotten in NOTIFICATION_PACKET_NAMES, the
 * ordering-bug class (#4380) silently reopens — this test fails instead.
 */
describe("NOTIFICATION_PACKET_NAMES completeness", () => {
	const eventsDir = join(__dirname, "..", "..", "src", "packets", "events");

	it("contains every event/broadcast packet class", async () => {
		const eventFiles = readdirSync(eventsDir).filter(file => file.endsWith(".ts"));
		expect(eventFiles.length).toBeGreaterThan(0);

		for (const file of eventFiles) {
			const moduleExports = await import(join(eventsDir, file)) as Record<string, unknown>;
			for (const exported of Object.values(moduleExports)) {
				if (typeof exported === "function" && exported.prototype instanceof CrowniclesPacket) {
					expect(NOTIFICATION_PACKET_NAMES.has(exported.name), `${exported.name} (from ${file}) is missing from NOTIFICATION_PACKET_NAMES`).toBe(true);
				}
			}
		}
	});
});

