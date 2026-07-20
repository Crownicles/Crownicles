import {
	describe, expect, it
} from "vitest";
import { ChannelType } from "discord.js";
import {
	getThreadSendAccessError, THREAD_SEND_ACCESS_ERRORS
} from "../../src/commands/ChannelPermissionUtils";

describe("getThreadSendAccessError", () => {
	it("allows non-thread channels", () => {
		expect(getThreadSendAccessError({ isThread: () => false })).toBeNull();
	});

	it("allows sendable threads", () => {
		expect(getThreadSendAccessError({
			isThread: () => true,
			sendable: true
		})).toBeNull();
	});

	it("reports when the bot has not joined a private thread", () => {
		expect(getThreadSendAccessError({
			isThread: () => true,
			sendable: false,
			type: ChannelType.PrivateThread,
			joined: false,
			manageable: false
		})).toBe(THREAD_SEND_ACCESS_ERRORS.NOT_JOINED);
	});

	it("keeps the permission error for other inaccessible threads", () => {
		expect(getThreadSendAccessError({
			isThread: () => true,
			sendable: false
		})).toBe(THREAD_SEND_ACCESS_ERRORS.CANNOT_SEND);
	});
});
