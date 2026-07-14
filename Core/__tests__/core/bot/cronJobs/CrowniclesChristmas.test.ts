import {
	afterEach, beforeEach, describe, expect, it, vi
} from "vitest";

vi.mock("../../../../../Lib/src/logs/CrowniclesLogger", () => ({
	CrowniclesLogger: {
		warn: vi.fn(),
		info: vi.fn(),
		error: vi.fn(),
		init: vi.fn(),
		get: vi.fn()
	}
}));

vi.mock("../../../../src/bootstrap", () => ({
	botConfig: { PREFIX: "test" }
}));

vi.mock("../../../../src/core/utils/PacketUtils", () => ({
	PacketUtils: {
		isMqttConnected: vi.fn(),
		announce: vi.fn()
	}
}));

vi.mock("../../../../src/core/database/game/models/Setting", () => ({
	Settings: {
		LAST_CHRISTMAS_BONUS_YEAR: {
			getValue: vi.fn(),
			setValue: vi.fn()
		}
	}
}));

vi.mock("../../../../src/core/database/game/models/Player", () => ({
	default: { update: vi.fn() }
}));

import { CrowniclesChristmas } from "../../../../src/core/bot/cronJobs/CrowniclesChristmas";
import { PacketUtils } from "../../../../src/core/utils/PacketUtils";
import { Settings } from "../../../../src/core/database/game/models/Setting";
import Player from "../../../../src/core/database/game/models/Player";
import { TokensConstants } from "../../../../../Lib/src/constants/TokensConstants";
import { ChristmasBonusAnnouncementPacket } from "../../../../../Lib/src/packets/announcements/ChristmasBonusAnnouncementPacket";

describe("CrowniclesChristmas.christmasBonus", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.mocked(PacketUtils.isMqttConnected).mockReset();
		vi.mocked(PacketUtils.announce).mockReset();
		vi.mocked(Settings.LAST_CHRISTMAS_BONUS_YEAR.getValue).mockReset();
		vi.mocked(Settings.LAST_CHRISTMAS_BONUS_YEAR.setValue).mockReset()
			.mockResolvedValue(undefined);
		vi.mocked(Player.update).mockReset()
			.mockResolvedValue([0] as never);
	});

	afterEach(() => {
		vi.clearAllTimers();
		vi.useRealTimers();
	});

	it("does not apply the bonus when MQTT is disconnected", async () => {
		vi.mocked(PacketUtils.isMqttConnected).mockReturnValue(false);

		await CrowniclesChristmas.christmasBonus();

		expect(Player.update).not.toHaveBeenCalled();
		expect(PacketUtils.announce).not.toHaveBeenCalled();
		expect(Settings.LAST_CHRISTMAS_BONUS_YEAR.setValue).not.toHaveBeenCalled();
	});

	it("skips when the bonus was already applied this year (idempotence guard)", async () => {
		const currentYear = new Date().getFullYear();
		vi.mocked(PacketUtils.isMqttConnected).mockReturnValue(true);
		vi.mocked(Settings.LAST_CHRISTMAS_BONUS_YEAR.getValue).mockResolvedValue(currentYear);

		await CrowniclesChristmas.christmasBonus();

		expect(Player.update).not.toHaveBeenCalled();
		expect(PacketUtils.announce).not.toHaveBeenCalled();
		expect(Settings.LAST_CHRISTMAS_BONUS_YEAR.setValue).not.toHaveBeenCalled();
	});

	it("applies the bonus, records the year and announces it when not yet applied", async () => {
		const currentYear = new Date().getFullYear();
		vi.mocked(PacketUtils.isMqttConnected).mockReturnValue(true);
		vi.mocked(Settings.LAST_CHRISTMAS_BONUS_YEAR.getValue).mockResolvedValue(0);

		await CrowniclesChristmas.christmasBonus();

		expect(Player.update).toHaveBeenCalledWith({ tokens: TokensConstants.MAX }, { where: {} });
		expect(Settings.LAST_CHRISTMAS_BONUS_YEAR.setValue).toHaveBeenCalledWith(currentYear);
		expect(PacketUtils.announce).toHaveBeenCalledTimes(1);

		const announcedPacket = vi.mocked(PacketUtils.announce).mock.calls[0][0] as ChristmasBonusAnnouncementPacket;
		expect(announcedPacket.isPreAnnouncement).toBe(false);
	});
});

describe("CrowniclesChristmas.christmasPreAnnouncement", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.mocked(PacketUtils.isMqttConnected).mockReset();
		vi.mocked(PacketUtils.announce).mockReset();
	});

	afterEach(() => {
		vi.clearAllTimers();
		vi.useRealTimers();
	});

	it("sends the pre-announcement when MQTT is connected", () => {
		vi.mocked(PacketUtils.isMqttConnected).mockReturnValue(true);

		CrowniclesChristmas.christmasPreAnnouncement();

		expect(PacketUtils.announce).toHaveBeenCalledTimes(1);
		const announcedPacket = vi.mocked(PacketUtils.announce).mock.calls[0][0] as ChristmasBonusAnnouncementPacket;
		expect(announcedPacket.isPreAnnouncement).toBe(true);
	});

	it("does not send the pre-announcement when MQTT is disconnected", () => {
		vi.mocked(PacketUtils.isMqttConnected).mockReturnValue(false);

		CrowniclesChristmas.christmasPreAnnouncement();

		expect(PacketUtils.announce).not.toHaveBeenCalled();
	});
});
