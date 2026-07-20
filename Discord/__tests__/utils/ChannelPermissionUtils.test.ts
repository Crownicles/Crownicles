import {
	describe, expect, it
} from "vitest";
import { hasThreadSendAccess } from "../../src/commands/ChannelPermissionUtils";

describe("hasThreadSendAccess", () => {
	it("allows non-thread channels", () => {
		expect(hasThreadSendAccess({ isThread: () => false })).toBe(true);
	});

	it("allows sendable threads", () => {
		expect(hasThreadSendAccess({
			isThread: () => true,
			sendable: true
		})).toBe(true);
	});

	it("rejects threads where Discord cannot send messages", () => {
		expect(hasThreadSendAccess({
			isThread: () => true,
			sendable: false
		})).toBe(false);
	});
});