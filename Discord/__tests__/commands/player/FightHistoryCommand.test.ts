import {
	describe, expect, it, vi
} from "vitest";

vi.mock("../../../src/bot/CrowniclesShard", () => ({
	keycloakConfig: {}
}));

import {
	buildKingGuardStatsDescription, buildPacketHistoryDescription
} from "../../../src/commands/player/FightHistoryCommand";
import { KingGuardFightStats } from "../../../../Lib/src/types/KingGuardFightStats";
import { DisplayUtils } from "../../../src/utils/DisplayUtils";
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

describe("buildKingGuardStatsDescription", () => {
	const viewer = "viewerKeycloakId";
	const stats: KingGuardFightStats = {
		won: 12,
		lost: 3,
		draw: 1,
		playerLevel: 140,
		record: {
			level: 152,
			recordsBroken: 4,
			rank: 2,
			challengers: 5
		},
		kingdomRecord: {
			keycloakId: "leaderKeycloakId",
			level: 188
		}
	};

	it("shows the record above the player level, the rank and the kingdom record holder", async () => {
		vi.spyOn(DisplayUtils, "getEscapedUsername").mockResolvedValue("Leader");

		const description = await buildKingGuardStatsDescription(stats, viewer, "fr");

		expect(description).toContain("152");
		expect(description).toContain("12 niveaux au-dessus du vôtre");
		expect(description).toContain("2 / 5");
		expect(description).toContain("188");
		expect(description).toContain("Leader");
		expect(description).toContain(`${CrowniclesIcons.fightHistory.won} Victoires : 12`);
		expect(description).not.toMatch(/undefined|NaN|\{\{/);
	});

	it("congratulates the holder of the kingdom record and hides the level gap when the record is not above the player", async () => {
		const description = await buildKingGuardStatsDescription({
			...stats,
			playerLevel: 160,
			kingdomRecord: {
				keycloakId: viewer,
				level: 152
			}
		}, viewer, "fr");

		expect(description).toContain(i18n.t("commands:fightHistory.kingGuardStats.kingdomRecordHolder", { lng: "fr" }));
		expect(description).not.toContain("au-dessus");
	});

	it("tells a player who never beat a guard that it has no record yet, without rank", async () => {
		vi.spyOn(DisplayUtils, "getEscapedUsername").mockResolvedValue("Leader");
		const { record: _record, ...withoutRecord } = stats;

		const description = await buildKingGuardStatsDescription(withoutRecord, viewer, "fr");

		expect(description).toContain(i18n.t("commands:fightHistory.kingGuardStats.noRecord", { lng: "fr" }));
		expect(description).not.toContain("/ 5");
		expect(description).toContain("Leader");
	});
});
