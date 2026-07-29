import {
	afterEach, beforeEach, describe, expect, it, vi
} from "vitest";
import { PacketUtils } from "../../../src/core/utils/PacketUtils";
import { mqttClient } from "../../../src/mqttClient";
import {
	CrowniclesPacket, PacketContext, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";
import { PlayerDeathPacket } from "../../../../Lib/src/packets/events/PlayerDeathPacket";
import { PlayerLevelUpPacket } from "../../../../Lib/src/packets/events/PlayerLevelUpPacket";

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
			makePacket(PlayerDeathPacket, {}),
			makePacket(PlayerLevelUpPacket, {
				level: 2,
				health: true,
				energy: true,
				fightPoints: true,
				classesTier: undefined
			})
		];

		PacketUtils.sendPackets(context, packets);

		expect(getSentPacketNames(publishSpy)).toStrictEqual(["PlayerLevelUpPacket", "PlayerDeathPacket"]);
	});

	it("keeps the original order when nobody died", () => {
		const publishSpy = vi.spyOn(mqttClient, "publish")
			.mockImplementation(() => mqttClient);
		const packets: CrowniclesPacket[] = [
			makePacket(PlayerLevelUpPacket, {
				level: 2,
				health: true,
				energy: true,
				fightPoints: true,
				classesTier: undefined
			}),
			makePacket(PlayerLevelUpPacket, {
				level: 3,
				health: true,
				energy: true,
				fightPoints: true,
				classesTier: undefined
			})
		];

		PacketUtils.sendPackets(context, packets);

		expect(getSentPacketNames(publishSpy)).toStrictEqual(["PlayerLevelUpPacket", "PlayerLevelUpPacket"]);
	});
});
