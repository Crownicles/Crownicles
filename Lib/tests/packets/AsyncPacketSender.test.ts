import {
	describe, it, expect
} from "vitest";
import { AsyncPacketSender } from "../../src/packets/AsyncPacketSender";
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

// Minimal stand-in response packets (only their class name matters here).
class FooRes extends CrowniclesPacket {}
class BarRes extends CrowniclesPacket {}

function makeContext(): PacketContext {
	return {
		frontEndOrigin: "test",
		frontEndSubOrigin: "test"
	};
}

describe("AsyncPacketSender.handleResponse", () => {
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

	it("with expectedResponses, ignores unlisted packets and consumes only a listed one", async () => {
		const sender = new TestPacketSender();
		const ctx = makeContext();
		const received: string[] = [];

		await sender.sendPacketAndHandleResponse(
			ctx,
			new FooRes(),
			(_c, name) => {
				received.push(name);
			},
			[FooRes]
		);

		// BarRes is neither a notification nor an expected response: leave it alone.
		const barConsumed = await sender.handleResponse(ctx, BarRes.name, new BarRes());
		expect(barConsumed).toBe(false);
		expect(received).toEqual([]);

		const fooConsumed = await sender.handleResponse(ctx, FooRes.name, new FooRes());
		expect(fooConsumed).toBe(true);
		expect(received).toEqual([FooRes.name]);
	});

	it("returns false when there is no pending request for the context", async () => {
		const sender = new TestPacketSender();
		const ctx = makeContext();
		ctx.packetId = "unknown-id";

		const consumed = await sender.handleResponse(ctx, FooRes.name, new FooRes());
		expect(consumed).toBe(false);
	});
});
