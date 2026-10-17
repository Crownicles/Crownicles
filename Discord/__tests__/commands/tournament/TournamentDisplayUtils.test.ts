import {
	describe, expect, it
} from "vitest";
import { LANGUAGE } from "../../../../Lib/src/Language";
import {
	TournamentCategories, TournamentLevelLimitModes
} from "../../../../Lib/src/types/Tournament";
import { TournamentConstants } from "../../../../Lib/src/constants/TournamentConstants";
import {
	getTournamentCategoryLabel, getTournamentThresholdsProgress
} from "../../../src/commands/tournament/TournamentDisplayUtils";

describe("Tournament display", () => {
	it("names categories after the levels they contain", () => {
		const lowCategory = getTournamentCategoryLabel(TournamentCategories.LEVEL_50, LANGUAGE.FRENCH);
		const highCategory = getTournamentCategoryLabel(TournamentCategories.LEVEL_100, LANGUAGE.FRENCH);
		expect(lowCategory).toContain(String(TournamentConstants.MINIMUM_PLAYER_LEVEL));
		expect(lowCategory).toContain(String(TournamentConstants.HIGH_CATEGORY_MIN_LEVEL - 1));
		expect(highCategory).toContain(String(TournamentConstants.HIGH_CATEGORY_MIN_LEVEL));
	});

	it("only lists the categories that can still receive participants", () => {
		const counts = {
			total: 3,
			byCategory: {
				[TournamentCategories.LEVEL_50]: 3,
				[TournamentCategories.LEVEL_100]: 0
			}
		};
		const highCategory = getTournamentCategoryLabel(TournamentCategories.LEVEL_100, LANGUAGE.FRENCH);
		const bothCategories = getTournamentThresholdsProgress({
			levelLimitMode: TournamentLevelLimitModes.CATEGORY,
			levelCap: null
		}, counts, LANGUAGE.FRENCH);
		const lowCategoryOnly = getTournamentThresholdsProgress({
			levelLimitMode: TournamentLevelLimitModes.REJECT,
			levelCap: TournamentConstants.HIGH_CATEGORY_MIN_LEVEL - 1
		}, counts, LANGUAGE.FRENCH);
		expect(bothCategories).toContain(highCategory);
		expect(lowCategoryOnly).not.toContain(highCategory);
	});
});
