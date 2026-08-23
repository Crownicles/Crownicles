import { describe, expect, it, vi } from "vitest";

vi.mock("../../../src/bot/CrowniclesShard", () => ({
	keycloakConfig: {}
}));

import { commandInfo } from "../../../src/commands/player/TopCommand";
import { CommandTopPacketReq } from "../../../../Lib/src/packets/commands/CommandTopPacket";
import { TopDataType } from "../../../../Lib/src/types/TopDataType";
import { TopTiming } from "../../../../Lib/src/types/TopTimings";

describe("top command packet", () => {
	it("reads the duration option for weekly score rankings", async () => {
		const deferReply = vi.fn().mockResolvedValue(undefined);
		const getString = vi.fn().mockReturnValue(TopTiming.WEEK);
		const interaction = {
			deferReply,
			options: {
				getSubcommand: vi.fn().mockReturnValue("score"),
				getString,
				getInteger: vi.fn().mockReturnValue(null)
			}
		};

		const packet = await commandInfo.getPacket(interaction as never, {} as never);

		expect(packet).toBeInstanceOf(CommandTopPacketReq);
		expect(packet.dataType).toBe(TopDataType.SCORE);
		expect(packet.timing).toBe(TopTiming.WEEK);
		expect(getString).toHaveBeenCalledWith("duration");
		expect(deferReply).toHaveBeenCalledOnce();
	});
});