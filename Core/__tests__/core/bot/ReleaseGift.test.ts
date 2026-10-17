import {
	afterEach, beforeEach, describe, expect, it, vi
} from "vitest";

vi.mock("../../../../Lib/src/logs/CrowniclesLogger", () => ({
	CrowniclesLogger: {
		warn: vi.fn(),
		info: vi.fn(),
		error: vi.fn(),
		init: vi.fn(),
		get: vi.fn()
	}
}));

vi.mock("../../../src/bootstrap", () => ({
	botConfig: { PREFIX: "test" }
}));

vi.mock("../../../src/core/utils/PacketUtils", () => ({
	PacketUtils: {
		isMqttConnected: vi.fn(),
		announce: vi.fn()
	}
}));

vi.mock("../../../src/core/database/game/models/Setting", () => ({
	Settings: {
		RELEASE_GIFT_600_APPLIED: {
			getValue: vi.fn(),
			setValue: vi.fn()
		}
	}
}));

vi.mock("../../../src/core/database/game/models/Player", () => ({
	default: { update: vi.fn() }
}));

import { ReleaseGift } from "../../../src/core/bot/ReleaseGift";
import { PacketUtils } from "../../../src/core/utils/PacketUtils";
import { Settings } from "../../../src/core/database/game/models/Setting";
import Player from "../../../src/core/database/game/models/Player";
import { TokensConstants } from "../../../../Lib/src/constants/TokensConstants";
import { ReleaseGiftConstants } from "../../../../Lib/src/constants/ReleaseGiftConstants";
import { ReleaseGiftAnnouncementPacket } from "../../../../Lib/src/packets/announcements/ReleaseGiftAnnouncementPacket";

describe("ReleaseGift.apply", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.mocked(PacketUtils.isMqttConnected).mockReset();
		vi.mocked(PacketUtils.announce).mockReset();
		vi.mocked(Settings.RELEASE_GIFT_600_APPLIED.getValue).mockReset();
		vi.mocked(Settings.RELEASE_GIFT_600_APPLIED.setValue).mockReset()
			.mockResolvedValue(undefined);
		vi.mocked(Player.update).mockReset()
			.mockResolvedValue([0] as never);
	});

	afterEach(() => {
		vi.clearAllTimers();
		vi.useRealTimers();
	});

	it("does not apply the gift when MQTT is disconnected", async () => {
		vi.mocked(PacketUtils.isMqttConnected).mockReturnValue(false);

		await ReleaseGift.apply();

		expect(Player.update).not.toHaveBeenCalled();
		expect(PacketUtils.announce).not.toHaveBeenCalled();
		expect(Settings.RELEASE_GIFT_600_APPLIED.setValue).not.toHaveBeenCalled();
	});

	it("skips when the gift was already applied (idempotence guard)", async () => {
		vi.mocked(PacketUtils.isMqttConnected).mockReturnValue(true);
		vi.mocked(Settings.RELEASE_GIFT_600_APPLIED.getValue).mockResolvedValue(1);

		await ReleaseGift.apply();

		expect(Player.update).not.toHaveBeenCalled();
		expect(PacketUtils.announce).not.toHaveBeenCalled();
		expect(Settings.RELEASE_GIFT_600_APPLIED.setValue).not.toHaveBeenCalled();
	});

	it("grants full tokens, records the flag and announces when not yet applied", async () => {
		vi.mocked(PacketUtils.isMqttConnected).mockReturnValue(true);
		vi.mocked(Settings.RELEASE_GIFT_600_APPLIED.getValue).mockResolvedValue(0);

		await ReleaseGift.apply();

		expect(Player.update).toHaveBeenCalledTimes(1);
		const [values, options] = vi.mocked(Player.update).mock.calls[0];
		expect((values as { tokens: number }).tokens).toBe(TokensConstants.MAX);
		expect((values as { money: unknown }).money).toBeDefined();
		expect(options).toEqual({ where: {} });
		expect(Settings.RELEASE_GIFT_600_APPLIED.setValue).toHaveBeenCalledWith(1);
		expect(PacketUtils.announce).toHaveBeenCalledTimes(1);
		expect(vi.mocked(PacketUtils.announce).mock.calls[0][0]).toBeInstanceOf(ReleaseGiftAnnouncementPacket);
	});
});

describe("ReleaseGiftConstants", () => {
	it("grants a positive amount of money", () => {
		expect(ReleaseGiftConstants.MONEY).toBeGreaterThan(0);
	});
});
