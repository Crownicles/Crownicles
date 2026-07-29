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
