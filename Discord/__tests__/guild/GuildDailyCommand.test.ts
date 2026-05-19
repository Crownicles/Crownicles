import { describe, expect, it } from "vitest";
import { getCommandGuildDailyRewardPacketString } from "../../src/commands/guild/GuildDailyCommand";
import { CommandGuildDailyRewardPacket } from "../../../Lib/src/packets/commands/CommandGuildDailyPacket";

describe("getCommandGuildDailyRewardPacketString", () => {
	it("includes guild points and treasury bonus in French", () => {
		const packet = {
			guildName: "Les Testeurs",
			guildPoints: 42
		} as CommandGuildDailyRewardPacket;

		const description = getCommandGuildDailyRewardPacketString(packet, "fr");

		expect(description).toContain("Points de guilde");
		expect(description).toContain("trésorerie");
		expect(description).toContain("42");
	});
});