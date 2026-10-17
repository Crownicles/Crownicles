import {
	describe, expect, it, vi
} from "vitest";

vi.mock("../../../src/bot/CrowniclesShard", () => ({
	keycloakConfig: {}
}));

import { buildPacketHistoryDescription } from "../../../src/commands/player/FightHistoryCommand";
import { KingGuardFightHistoryItem } from "../../../../Lib/src/packets/commands/CommandFightHistoryPacket";
import { EloGameResult } from "../../../../Lib/src/types/EloGameResult";
import { ClassConstants } from "../../../../Lib/src/constants/ClassConstants";
import { CrowniclesIcons } from "../../../../Lib/src/CrowniclesIcons";
import i18n from "../../../src/translations/i18n";

describe("buildPacketHistoryDescription", () => {
	it("renders a king guard fight with its level, its class and no glory", async () => {
		const fight: KingGuardFightHistoryItem = {
			date: Date.now(),
			result: EloGameResult.WIN,
			classes: {
				me: ClassConstants.CLASSES_ID.KNIGHT,
				opponent: ClassConstants.CLASSES_ID.PALADIN
			},
			kingGuard: { level: 42 }
		};

		const description = await buildPacketHistoryDescription([fight], 0, 1, "fr");

		expect(description).toContain("garde du roi");
		expect(description).toContain("42");
		expect(description).toContain(i18n.t(`models:classes.${ClassConstants.CLASSES_ID.PALADIN}`, { lng: "fr" }));
		expect(description).toContain(CrowniclesIcons.fightHistory.won);
		expect(description).not.toMatch(/undefined|NaN|\{\{/);
	});
});
