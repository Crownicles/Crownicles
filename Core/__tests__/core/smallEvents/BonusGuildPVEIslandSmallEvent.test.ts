import {
	beforeEach, describe, expect, it, vi
} from "vitest";
import {
	SmallEventBonusGuildPVEIslandEmote,
	SmallEventBonusGuildPVEIslandPacket,
	SmallEventBonusGuildPVEIslandResultType
} from "../../../../Lib/src/packets/smallEvents/SmallEventBonusGuildPVEIslandPacket";
import { smallEventFuncs } from "../../../src/core/smallEvents/bonusGuildPVEIsland";
import { Maps } from "../../../src/core/maps/Maps";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { SmallEventDataController } from "../../../src/data/SmallEvent";

describe("bonus guild PVE island small event", () => {
	const player = {
		guildId: 1,
		hasAGuild: vi.fn().mockReturnValue(true),
		addHealth: vi.fn().mockResolvedValue(true),
		save: vi.fn().mockResolvedValue(undefined)
	};

	beforeEach(() => {
		vi.restoreAllMocks();
		vi.spyOn(Maps, "getGuildMembersOnPveIsland").mockResolvedValue([]);
		vi.spyOn(SmallEventDataController.instance, "getById").mockReturnValue({
			getProperties: () => ({
				ranges: { life: { min: 5, max: 5 } },
				events: [
					{},
					{
						lose: {
							withGuild: "life",
							solo: "life"
						}
					}
				]
			})
		} as never);
		vi.spyOn(RandomUtils, "randInt")
			.mockReturnValueOnce(1)
			.mockReturnValueOnce(99)
			.mockReturnValueOnce(1)
			.mockReturnValueOnce(5);
	});

	it("reports a health loss when the earthquake damages the player", async () => {
		const response: SmallEventBonusGuildPVEIslandPacket[] = [];

		await smallEventFuncs.executeSmallEvent(response, player as never, {} as never, {} as never);

		expect(player.addHealth).toHaveBeenCalledWith(expect.objectContaining({ amount: -5 }));
		expect(response).toContainEqual(expect.objectContaining({
			result: SmallEventBonusGuildPVEIslandResultType.LOSE,
			emoteKey: SmallEventBonusGuildPVEIslandEmote.LOST_HEALTH
		}));
	});
});
