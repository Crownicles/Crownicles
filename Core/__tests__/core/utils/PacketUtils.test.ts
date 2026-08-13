import {
	afterEach, beforeEach, describe, expect, it, vi
} from "vitest";
import { PacketUtils } from "../../../src/core/utils/PacketUtils";
import { mqttClient } from "../../../src/mqttClient";
import {
	CrowniclesPacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";
import { PlayerDeathPacket } from "../../../../Lib/src/packets/events/PlayerDeathPacket";
import { PlayerLevelUpPacket } from "../../../../Lib/src/packets/events/PlayerLevelUpPacket";
import { PlayerLeavePveIslandPacket } from "../../../../Lib/src/packets/events/PlayerLeavePveIslandPacket";
import { ErrorInternalPacket } from "../../../../Lib/src/packets/commands/ErrorPacket";

const context = { discord: { shardId: 0 } } as PacketContext;

function getSentPacketNames(publishSpy: ReturnType<typeof vi.spyOn>): string[] {
	const payload = JSON.parse(publishSpy.mock.calls[0][1] as string) as {
		packets: { name: string }[];
	};
	return payload.packets.map(packet => packet.name);
}

describe("PacketUtils.sendPackets", () => {
	beforeEach(() => {
		vi.spyOn(CrowniclesLogger, "debug")
			.mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("sends the death packet last so the narration is not cut in half", () => {
		const publishSpy = vi.spyOn(mqttClient, "publish")
			.mockImplementation(() => mqttClient);
		const packets: CrowniclesPacket[] = [
			new PlayerDeathPacket(),
			new PlayerLevelUpPacket()
		];

		PacketUtils.sendPackets(context, packets);

		expect(getSentPacketNames(publishSpy)).toStrictEqual(["PlayerLevelUpPacket", "PlayerDeathPacket"]);
	});

	it("keeps the original order when nobody died", () => {
		const publishSpy = vi.spyOn(mqttClient, "publish")
			.mockImplementation(() => mqttClient);
		const packets: CrowniclesPacket[] = [
			new PlayerLevelUpPacket(),
			new PlayerLeavePveIslandPacket()
		];

		PacketUtils.sendPackets(context, packets);

		expect(getSentPacketNames(publishSpy)).toStrictEqual(["PlayerLevelUpPacket", "PlayerLeavePveIslandPacket"]);
	});
});

describe("PacketUtils.pushInternalError", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("sends the reason to the player but never the caught exception", () => {
		vi.spyOn(CrowniclesLogger, "errorWithObj")
			.mockImplementation(() => {});
		const response: CrowniclesPacket[] = [];

		PacketUtils.pushInternalError(response, "the shop could not be built", new Error("connection timeout on table players"));

		expect(response).toHaveLength(1);
		expect(response[0]).toBeInstanceOf(ErrorInternalPacket);
		expect((response[0] as ErrorInternalPacket).reason).toBe("the shop could not be built");
		expect(JSON.stringify(response[0])).not.toContain("connection timeout");
	});

	it("logs the reason server-side", () => {
		const errorSpy = vi.spyOn(CrowniclesLogger, "error")
			.mockImplementation(() => {});

		PacketUtils.pushInternalError([], "small event xyz is missing");

		expect(errorSpy).toHaveBeenCalledWith("small event xyz is missing");
	});

	it("logs the caught exception alongside the reason when there is one", () => {
		const errorWithObjSpy = vi.spyOn(CrowniclesLogger, "errorWithObj")
			.mockImplementation(() => {});
		const cause = new Error("SQLState 08S01");

		PacketUtils.pushInternalError([], "packet processing failed", cause);

		expect(errorWithObjSpy).toHaveBeenCalledWith("packet processing failed", cause);
	});
});
