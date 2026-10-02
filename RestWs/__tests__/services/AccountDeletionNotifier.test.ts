import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {notifyDeletionRequest} from "../../src/services/AccountDeletionNotifier";
import type {AccountDeletionConfig} from "../../src/config/RestWsConfig";

const {sendMail, createTransport} = vi.hoisted(() => ({sendMail: vi.fn(), createTransport: vi.fn()}));
vi.mock("nodemailer", () => ({createTransport}));
vi.mock("../../../Lib/src/logs/CrowniclesLogger", () => ({CrowniclesLogger: {info: vi.fn(), errorWithObj: vi.fn()}}));

const request = {keycloakId: "test-player", username: "test-player"};
const config: AccountDeletionConfig = {
	SECRET: "test-secret",
	WEBHOOK_URL: "",
	SMTP: {HOST: "", PORT: 587, USERNAME: "", PASSWORD: "", FROM: "", TO: ""}
};

describe("account deletion request delivery", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		createTransport.mockReturnValue({sendMail});
		sendMail.mockResolvedValue({});
	});

	afterEach(() => vi.unstubAllGlobals());

	it("does not report a delivered request when no channel is configured", async () => {
		expect(await notifyDeletionRequest(request, config)).toBe(false);
		expect(createTransport).not.toHaveBeenCalled();
	});

	it("reports delivery through a configured email channel", async () => {
		expect(await notifyDeletionRequest(request, {...config, SMTP: {...config.SMTP, HOST: "smtp.example.test", FROM: "sender@example.test", TO: "admin@example.test"}})).toBe(true);
		expect(sendMail).toHaveBeenCalledTimes(1);
	});

	it("keeps the other channel usable when email delivery fails", async () => {
		sendMail.mockRejectedValueOnce(new Error("mail unavailable"));
		const fetch = vi.fn().mockResolvedValue({ok: true});
		vi.stubGlobal("fetch", fetch);
		expect(await notifyDeletionRequest(request, {...config, WEBHOOK_URL: "https://example.test/webhook", SMTP: {...config.SMTP, HOST: "smtp.example.test", FROM: "sender@example.test", TO: "admin@example.test"}})).toBe(true);
		expect(fetch).toHaveBeenCalledTimes(1);
	});

	it("does not report delivery when every configured channel fails", async () => {
		sendMail.mockRejectedValueOnce(new Error("mail unavailable"));
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ok: false, status: 503}));
		expect(await notifyDeletionRequest(request, {...config, WEBHOOK_URL: "https://example.test/webhook", SMTP: {...config.SMTP, HOST: "smtp.example.test", FROM: "sender@example.test", TO: "admin@example.test"}})).toBe(false);
	});
});