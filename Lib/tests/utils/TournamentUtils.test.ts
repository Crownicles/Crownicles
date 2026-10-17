import {
	describe, expect, it
} from "vitest";
import { getTournamentEligibleCategories } from "../../src/utils/TournamentUtils";
import {
	TournamentCategories, TournamentLevelLimitModes
} from "../../src/types/Tournament";
import { TournamentConstants } from "../../src/constants/TournamentConstants";

describe("getTournamentEligibleCategories", () => {
	it("keeps both categories when no level is refused", () => {
		expect(getTournamentEligibleCategories({
			levelLimitMode: TournamentLevelLimitModes.CATEGORY,
			levelCap: null
		})).toEqual([TournamentCategories.LEVEL_50, TournamentCategories.LEVEL_100]);
		expect(getTournamentEligibleCategories({
			levelLimitMode: TournamentLevelLimitModes.CAP,
			levelCap: TournamentConstants.MINIMUM_PLAYER_LEVEL
		})).toEqual([TournamentCategories.LEVEL_50, TournamentCategories.LEVEL_100]);
	});

	it("drops the high category when every one of its levels is refused", () => {
		expect(getTournamentEligibleCategories({
			levelLimitMode: TournamentLevelLimitModes.REJECT,
			levelCap: TournamentConstants.HIGH_CATEGORY_MIN_LEVEL - 1
		})).toEqual([TournamentCategories.LEVEL_50]);
	});

	it("keeps the high category when its lowest level is still accepted", () => {
		expect(getTournamentEligibleCategories({
			levelLimitMode: TournamentLevelLimitModes.REJECT,
			levelCap: TournamentConstants.HIGH_CATEGORY_MIN_LEVEL
		})).toEqual([TournamentCategories.LEVEL_50, TournamentCategories.LEVEL_100]);
	});
});
