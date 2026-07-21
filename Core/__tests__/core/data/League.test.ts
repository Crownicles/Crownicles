import { describe, expect, it } from "vitest";
import { LeagueInfoConstants } from "../../../../Lib/src/constants/LeagueInfoConstants";
import { League } from "../../../src/data/League";

describe("League", () => {
	it("returns its configured PvP fight win money reward", () => {
		for (const [leagueId, expectedReward] of LeagueInfoConstants.FIGHT_WIN_MONEY_REWARDS.entries()) {
			const league = new League();
			league.id = leagueId;

			expect(league.getFightWinMoneyReward()).toBe(expectedReward);
		}
	});
});