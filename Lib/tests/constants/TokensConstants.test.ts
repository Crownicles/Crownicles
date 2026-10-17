import {
	describe, expect, it
} from "vitest";
import { TokensConstants } from "../../src/constants/TokensConstants";

/*
 * The expression is evaluated by MariaDB, so it cannot be run here: the tests below pin the two
 * properties the daily and Christmas crons rely on, and every caller reuses this single definition
 * instead of rewriting the SQL (issue #4590).
 */
describe("TokensConstants.buildRefillExpression", () => {
	it("never lowers the tokens of a player above the cap", () => {
		expect(TokensConstants.buildRefillExpression()).toContain("GREATEST(tokens,");
		expect(TokensConstants.buildRefillExpression(TokensConstants.DAILY.FREE_PER_DAY)).toContain("GREATEST(tokens,");
	});

	it("tops up to the cap when no daily gain is given", () => {
		expect(TokensConstants.buildRefillExpression()).toBe(`GREATEST(tokens, ${TokensConstants.MAX})`);
	});

	it("caps the daily gain at the maximum", () => {
		expect(TokensConstants.buildRefillExpression(TokensConstants.DAILY.FREE_PER_DAY))
			.toBe(`GREATEST(tokens, LEAST(${TokensConstants.MAX}, tokens + ${TokensConstants.DAILY.FREE_PER_DAY}))`);
	});
});
