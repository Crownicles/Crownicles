import {
	describe, expect, it
} from "vitest";
import { ChannelType } from "discord.js";
import i18n from "../../src/translations/i18n";
import { LANGUAGE } from "../../../Lib/src/Language";
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
		const error = getThreadSendAccessError({
			isThread: () => true,
			sendable: false,
			type: ChannelType.PrivateThread,
			joined: false,
			manageable: false
		});

		expect(error).toBe(THREAD_SEND_ACCESS_ERRORS.NOT_JOINED);
		if (error === null) {
			throw new Error("Expected a private thread membership error");
		}
		expect(i18n.t(error, { lng: LANGUAGE.FRENCH })).not.toBe(error);
		expect(i18n.t(error, { lng: LANGUAGE.ENGLISH })).not.toBe(error);
	});

	it("keeps the permission error for other inaccessible threads", () => {
		expect(getThreadSendAccessError({
			isThread: () => true,
			sendable: false
		})).toBe(THREAD_SEND_ACCESS_ERRORS.CANNOT_SEND);
	});
});
