import {
	describe, expect, it, vi
} from "vitest";
import {
	SmallEventBonusGuildPVEIslandEmote,
	SmallEventBonusGuildPVEIslandOutcomeSurrounding,
	SmallEventBonusGuildPVEIslandPacket,
	SmallEventBonusGuildPVEIslandResultType
} from "../../../Lib/src/packets/smallEvents/SmallEventBonusGuildPVEIslandPacket";
import { buildBonusGuildPVEIslandDescription } from "../../src/smallEvents/BonusGuildPVEIslandDescription";

vi.mock("../../src/translations/i18n", () => ({
	default: {
		t: vi.fn((key: string) => key.endsWith(".intro")
			? "An earthquake starts."
			: "A boulder knocks you unconscious. You lose 5 ⚡.")
	}
}));

describe("bonus guild PVE island small event", () => {
	it("displays the health loss applied by Core despite a stale translation", () => {
		const packet = Object.assign(new SmallEventBonusGuildPVEIslandPacket(), {
			event: 1,
			result: SmallEventBonusGuildPVEIslandResultType.LOSE,
			surrounding: SmallEventBonusGuildPVEIslandOutcomeSurrounding.WITH_GUILD,
			amount: 5,
			isExperienceGain: false,
			emoteKey: SmallEventBonusGuildPVEIslandEmote.LOST_HEALTH
		});

		const description = buildBonusGuildPVEIslandDescription(packet, "en");

		expect(description).toContain("You lose 5 💔");
		expect(description).not.toContain("⚡");
	});

	it("renders escape results without requiring a resource emote", () => {
		const packet = Object.assign(new SmallEventBonusGuildPVEIslandPacket(), {
			event: 1,
			result: SmallEventBonusGuildPVEIslandResultType.ESCAPE,
			surrounding: SmallEventBonusGuildPVEIslandOutcomeSurrounding.WITH_GUILD,
			amount: 0,
			isExperienceGain: false
		});

		const description = buildBonusGuildPVEIslandDescription(packet, "en");

		expect(description).not.toContain("undefined");
	});
});