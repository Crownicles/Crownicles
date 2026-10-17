import {
	describe, expect, it, vi
} from "vitest";
import {
	commandInfo, getCommandGuildDailyRewardPacketString
} from "../../src/commands/guild/GuildDailyCommand";
import {
	CommandGuildDailyPacketReq, CommandGuildDailyRewardPacket
} from "../../../Lib/src/packets/commands/CommandGuildDailyPacket";

describe("guild daily command packet", () => {
	it("defers the interaction before returning the packet", async () => {
		let finishDefer: (() => void) | undefined;
		const deferReply = vi.fn(() => new Promise<void>(resolve => {
			finishDefer = resolve;
		}));
		const packetPromise = commandInfo.getPacket({ deferReply } as never, {} as never);
		let packetReturned = false;
		void Promise.resolve(packetPromise).then(() => {
			packetReturned = true;
		});

		expect(deferReply).toHaveBeenCalledOnce();
		await Promise.resolve();
		expect(packetReturned).toBe(false);

		finishDefer!();
		await expect(packetPromise).resolves.toBeInstanceOf(CommandGuildDailyPacketReq);
	});
});

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