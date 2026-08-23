import { describe, expect, it, vi } from "vitest";

vi.mock("../../../src/bot/CrowniclesShard", () => ({
	keycloakConfig: {}
}));

import { buildFightConfirmationDescription } from "../../../src/commands/player/FightCommand";
import { ReactionCollectorFightData } from "../../../../Lib/src/packets/interaction/ReactionCollectorFight";

describe("buildFightConfirmationDescription", () => {
	it("keeps glory numeric in the confirmation message", () => {
		const data = {
			playerStats: {
				classId: 21,
				fightRanking: { glory: 1869 },
				energy: { value: 1869, max: 1869 },
				attack: 549,
				defense: 641,
				speed: 512,
				breath: { base: 17, max: 17, regen: 3 }
			}
		} satisfies ReactionCollectorFightData;

		const description = buildFightConfirmationDescription("fr", "Jack", data, "common");

		expect(description).not.toContain("NaN");
		expect(description).toMatch(/1\D869/);
	});
});