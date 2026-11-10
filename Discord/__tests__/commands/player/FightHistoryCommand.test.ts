import {
	describe, expect, it, vi
} from "vitest";

vi.mock("../../../src/bot/CrowniclesShard", () => ({
	keycloakConfig: {}
}));

import {
	buildKingGuardStatsDescription, buildPacketHistoryDescription
} from "../../../src/commands/player/FightHistoryCommand";
import {
	KingGuardDisplay, KingGuardFightStats
} from "../../../../Lib/src/types/KingGuardFightStats";
import { DisplayUtils } from "../../../src/utils/DisplayUtils";
import { KingGuardFightHistoryItem } from "../../../../Lib/src/packets/commands/CommandFightHistoryPacket";
import { EloGameResult } from "../../../../Lib/src/types/EloGameResult";
import { ClassConstants } from "../../../../Lib/src/constants/ClassConstants";
import { CrowniclesIcons } from "../../../../Lib/src/CrowniclesIcons";
import i18n from "../../../src/translations/i18n";

function guardName(guardId: number): string {
	return i18n.t(`kingGuards:names.${guardId}`, { lng: "fr" });
}

describe("buildPacketHistoryDescription", () => {
	const fight: KingGuardFightHistoryItem = {
		date: Date.now(),
		result: EloGameResult.WIN,
		classes: {
			me: ClassConstants.CLASSES_ID.KNIGHT,
			opponent: ClassConstants.CLASSES_ID.PALADIN
		},
		kingGuard: {
			level: 142, id: 7
		}
	};

	it("renders a king guard fight with the name of the guard, its level, its class and no glory", async () => {
		const description = await buildPacketHistoryDescription([fight], 0, 1, "fr");

		expect(description).toContain(`**Garde ${guardName(7)}**`);
		expect(description).toContain("142");
		expect(description).toContain(i18n.t(`models:classes.${ClassConstants.CLASSES_ID.PALADIN}`, { lng: "fr" }));
		expect(description).toContain(CrowniclesIcons.fightHistory.won);
		expect(description).not.toMatch(/undefined|NaN|\{\{/);
	});

	it("renders a fight against a guard generated before the library without a name", async () => {
		const description = await buildPacketHistoryDescription([
			{
				...fight, kingGuard: { level: 42 }
			}
		], 0, 1, "fr");

		expect(description).toContain("**un garde du roi**");
		expect(description).not.toMatch(/undefined|NaN|\{\{|kingGuards:/);
	});
});

describe("buildKingGuardStatsDescription", () => {
	const viewer = "viewerKeycloakId";

	function guardOf(id: number, level: number): KingGuardDisplay {
		return {
			id, level, classId: ClassConstants.CLASSES_ID.PALADIN
		};
	}

	const stats: KingGuardFightStats = {
		won: 12,
		lost: 3,
		draw: 1,
		playerLevel: 140,
		record: {
			guard: guardOf(2, 152),
			rank: 2,
			challengers: 7
		},
		leaderboard: [
			{
				keycloakId: "leaderKeycloakId", guard: guardOf(1, 188)
			},
			{
				keycloakId: viewer, guard: guardOf(2, 152)
			},
			{
				keycloakId: "thirdKeycloakId", guard: guardOf(3, 150)
			}
		]
	};

	it("shows the best guard beaten with its name, class and level above the player, its rank, its results and the leaderboard", async () => {
		vi.spyOn(DisplayUtils, "getEscapedUsername").mockImplementation(keycloakId => Promise.resolve(keycloakId === "leaderKeycloakId" ? "Leader" : "Third"));

		const description = await buildKingGuardStatsDescription(stats, viewer, "fr");

		expect(description).toContain(`Garde ${guardName(2)}`);
		expect(description).toContain(i18n.t(`models:classes.${ClassConstants.CLASSES_ID.PALADIN}`, { lng: "fr" }));
		expect(description).toContain("12 niveaux au-dessus du vôtre");
		expect(description).toContain("2 / 7");
		expect(description).toContain(`${CrowniclesIcons.fightHistory.won} Victoires : 12`);
		expect(description).toContain(`${CrowniclesIcons.top.badges.first} 1. **Leader** : Garde ${guardName(1)}, niv. 188`);
		expect(description).toContain(`${CrowniclesIcons.top.badges.second} 2. **Vous** : Garde ${guardName(2)}, niv. 152`);
		expect(description).toContain(`${CrowniclesIcons.top.badges.third} 3. **Third** : Garde ${guardName(3)}, niv. 150`);
		expect(description).not.toMatch(/undefined|NaN|\{\{|kingGuards:/);
	});

	it("adds the player after the leaderboard when it is ranked below it, and hides the level gap when the record is not above its level", async () => {
		vi.spyOn(DisplayUtils, "getEscapedUsername").mockResolvedValue("Other");

		const description = await buildKingGuardStatsDescription({
			...stats,
			playerLevel: 160,
			record: {
				guard: guardOf(4, 120),
				rank: 9,
				challengers: 9
			},
			leaderboard: stats.leaderboard.filter(challenger => challenger.keycloakId !== viewer)
		}, viewer, "fr");

		expect(description.trim().split("\n").at(-1)).toBe(`${CrowniclesIcons.top.badges.self} 9. **Vous** : Garde ${guardName(4)}, niv. 120`);
		expect(description).not.toContain("au-dessus");
	});

	it("shows the players ranked below the medals with a neutral badge, and the player with its own badge", async () => {
		vi.spyOn(DisplayUtils, "getEscapedUsername").mockImplementation(keycloakId => Promise.resolve(keycloakId));
		const leaderboard = Array.from({ length: 10 }, (_, index) => ({
			keycloakId: `player${index + 1}`,
			guard: guardOf(index + 10, 200 - index)
		}));

		const description = await buildKingGuardStatsDescription({
			...stats,
			record: {
				guard: guardOf(30, 150),
				rank: 1234,
				challengers: 2000
			},
			leaderboard
		}, viewer, "fr");

		expect(description).toContain(`${CrowniclesIcons.top.badges.fifth} 5. **player5** : Garde ${guardName(14)}, niv. 196`);
		expect(description).toContain(`${CrowniclesIcons.top.badges.default} 10. **player10** : Garde ${guardName(19)}, niv. 191`);
		const formatNumber = (value: number): string => new Intl.NumberFormat("fr").format(value);
		expect(description.trim().split("\n").at(-1)).toBe(`${CrowniclesIcons.top.badges.self} ${formatNumber(1234)}. **Vous** : Garde ${guardName(30)}, niv. 150`);
		expect(description).toContain(`${formatNumber(1234)} / ${formatNumber(2000)}`);
	});

	it("lists the player only once when its rank was read after another player pushed it out of the leaderboard", async () => {
		vi.spyOn(DisplayUtils, "getEscapedUsername").mockResolvedValue("Other");

		const description = await buildKingGuardStatsDescription({
			...stats,
			record: {
				...stats.record!,
				rank: stats.leaderboard.length + 1
			}
		}, viewer, "fr");

		expect(description.match(/\*\*Vous\*\*/gu)).toHaveLength(1);
	});

	it("tells a player who never beat a guard that it has no record yet, without rank", async () => {
		vi.spyOn(DisplayUtils, "getEscapedUsername").mockResolvedValue("Other");
		const { record: _record, ...withoutRecord } = stats;

		const description = await buildKingGuardStatsDescription({
			...withoutRecord,
			leaderboard: [stats.leaderboard[0]]
		}, viewer, "fr");

		expect(description).toContain(i18n.t("commands:fightHistory.kingGuardStats.noRecord", { lng: "fr" }));
		expect(description).not.toContain("/ 7");
		expect(description).not.toContain("Vous");
		expect(description).toContain("1. **Other**");
	});
});
