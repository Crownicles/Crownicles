import {
	describe, it, expect
} from "vitest";
import {
	scoreAlias,
	findBestMatch,
	searchAutocomplete,
	toDiscordChoices,
	AUTOCOMPLETE_SCORE,
	MAX_AUTOCOMPLETE_CHOICES,
	AutocompleteSearchItem
} from "../../src/utils/AutocompleteUtils";

describe("AutocompleteUtils", () => {
	describe("scoreAlias", () => {
		it("should return EXACT_MATCH score for exact matches", () => {
			expect(scoreAlias("help", "help")).toBe(AUTOCOMPLETE_SCORE.EXACT_MATCH);
			expect(scoreAlias("HELP", "help")).toBe(AUTOCOMPLETE_SCORE.EXACT_MATCH);
		});

		it("should return STARTS_WITH score for prefix matches", () => {
			const score = scoreAlias("hello", "hel");
			expect(score).toBeGreaterThan(AUTOCOMPLETE_SCORE.CONTAINS_BASE);
			expect(score).toBeLessThan(AUTOCOMPLETE_SCORE.EXACT_MATCH);
		});

		it("should prioritize shorter prefix matches", () => {
			const shortScore = scoreAlias("help", "he");
			const longScore = scoreAlias("helicopter", "he");
			expect(shortScore).toBeGreaterThan(longScore);
		});

		it("should return CONTAINS score for substring matches", () => {
			const score = scoreAlias("guild", "ui");
			expect(score).toBeGreaterThan(0);
			expect(score).toBeLessThan(AUTOCOMPLETE_SCORE.STARTS_WITH_BASE);
		});

		it("should prioritize shorter substring matches", () => {
			const shortScore = scoreAlias("build", "ui");
			const longScore = scoreAlias("beautiful", "ui");
			expect(shortScore).toBeGreaterThan(longScore);
		});

		it("should return 0 for non-matches", () => {
			expect(scoreAlias("help", "xyz")).toBe(0);
			expect(scoreAlias("profile", "qwerty")).toBe(0);
		});

		it("should be case-insensitive", () => {
			expect(scoreAlias("HELP", "help")).toBe(AUTOCOMPLETE_SCORE.EXACT_MATCH);
			expect(scoreAlias("Help", "HeLp")).toBe(AUTOCOMPLETE_SCORE.EXACT_MATCH);
		});
	});

	describe("findBestMatch", () => {
		it("should return the best matching alias", () => {
			const item: AutocompleteSearchItem = {
				key: "HELP",
				displayName: "help",
				aliases: ["help", "h", "aide", "a"]
			};

			const result = findBestMatch(item, "help");
			expect(result).not.toBeNull();
			expect(result!.alias).toBe("help");
			expect(result!.score).toBe(AUTOCOMPLETE_SCORE.EXACT_MATCH);
		});

		it("should prefer exact match over prefix match", () => {
			const item: AutocompleteSearchItem = {
				key: "HELP",
				displayName: "help",
				aliases: ["helpful", "help"]
			};

			const result = findBestMatch(item, "help");
			expect(result!.alias).toBe("help");
		});

		it("should prefer shorter prefix matches", () => {
			const item: AutocompleteSearchItem = {
				key: "HELP",
				displayName: "help",
				aliases: ["helicopter", "help", "helper"]
			};

			const result = findBestMatch(item, "hel");
			// "help" is shorter than "helper" and "helicopter"
			expect(result!.alias).toBe("help");
		});

		it("should return null if no aliases match", () => {
			const item: AutocompleteSearchItem = {
				key: "HELP",
				displayName: "help",
				aliases: ["help", "aide"]
			};

			const result = findBestMatch(item, "xyz");
			expect(result).toBeNull();
		});

		it("should handle empty aliases array", () => {
			const item: AutocompleteSearchItem = {
				key: "TEST",
				displayName: "test",
				aliases: []
			};

			const result = findBestMatch(item, "test");
			expect(result).toBeNull();
		});
	});

	describe("searchAutocomplete", () => {
		const testItems: AutocompleteSearchItem[] = [
			{
				key: "HELP",
				displayName: "help",
				aliases: ["help", "h", "aide"]
			},
			{
				key: "PROFILE",
				displayName: "profile",
				aliases: ["profile", "p", "profil"]
			},
			{
				key: "GUILD",
				displayName: "guild",
				aliases: ["guild", "guilde", "g"]
			},
			{
				key: "GUILD_HELP",
				displayName: "guild help",
				aliases: ["guildhelp", "guildeaide"]
			}
		];

		it("should return matches sorted by score", () => {
			const results = searchAutocomplete(testItems, "h");
			expect(results.length).toBeGreaterThan(0);
			
			// Check that scores are descending
			for (let i = 1; i < results.length; i++) {
				expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
			}
		});

		it("should return exact matches first", () => {
			const results = searchAutocomplete(testItems, "help");
			expect(results[0].key).toBe("HELP");
			expect(results[0].score).toBe(AUTOCOMPLETE_SCORE.EXACT_MATCH);
		});

		it("should limit results to maxResults", () => {
			const manyItems: AutocompleteSearchItem[] = Array.from({ length: 50 }, (_, i) => ({
				key: `ITEM_${i}`,
				displayName: `item ${i}`,
				aliases: [`item${i}`, `i${i}`]
			}));

			const results = searchAutocomplete(manyItems, "i", 10);
			expect(results.length).toBeLessThanOrEqual(10);
		});

		it("should respect Discord's default limit", () => {
			const manyItems: AutocompleteSearchItem[] = Array.from({ length: 50 }, (_, i) => ({
				key: `ITEM_${i}`,
				displayName: `item ${i}`,
				aliases: [`item${i}`, `i${i}`]
			}));

			const results = searchAutocomplete(manyItems, "i");
			expect(results.length).toBeLessThanOrEqual(MAX_AUTOCOMPLETE_CHOICES);
		});

		it("should return empty array if no matches", () => {
			const results = searchAutocomplete(testItems, "xyz");
			expect(results).toEqual([]);
		});

		it("should handle empty input", () => {
			const results = searchAutocomplete(testItems, "");
			// Empty string should match everything (contains)
			expect(results.length).toBeGreaterThan(0);
		});

		it("should be case-insensitive", () => {
			const results1 = searchAutocomplete(testItems, "HELP");
			const results2 = searchAutocomplete(testItems, "help");
			expect(results1).toEqual(results2);
		});

		it("should include all match data", () => {
			const results = searchAutocomplete(testItems, "help");
			expect(results[0]).toHaveProperty("name");
			expect(results[0]).toHaveProperty("value");
			expect(results[0]).toHaveProperty("score");
			expect(results[0]).toHaveProperty("key");
		});
	});

	describe("toDiscordChoices", () => {
		it("should convert matches to Discord format", () => {
			const matches = [
				{
					name: "help",
					value: "help",
					score: 1000,
					key: "HELP"
				},
				{
					name: "profile",
					value: "profile",
					score: 500,
					key: "PROFILE"
				}
			];

			const choices = toDiscordChoices(matches);
			expect(choices).toEqual([
				{ name: "help", value: "help" },
				{ name: "profile", value: "profile" }
			]);
		});

		it("should handle empty array", () => {
			const choices = toDiscordChoices([]);
			expect(choices).toEqual([]);
		});

		it("should only include name and value", () => {
			const matches = [
				{
					name: "test",
					value: "test",
					score: 100,
					key: "TEST"
				}
			];

			const choices = toDiscordChoices(matches);
			expect(choices[0]).not.toHaveProperty("score");
			expect(choices[0]).not.toHaveProperty("key");
		});
	});

	describe("Integration test", () => {
		it("should work end-to-end for command autocomplete", () => {
			const commands: AutocompleteSearchItem[] = [
				{
					key: "HELP",
					displayName: "help",
					aliases: ["help", "h", "aide", "a"]
				},
				{
					key: "PROFILE",
					displayName: "profile",
					aliases: ["profile", "p", "profil", "me", "info"]
				},
				{
					key: "GUILD_HELP",
					displayName: "guild help",
					aliases: ["guildhelp", "guildeaide", "gh"]
				}
			];

			// User types "h"
			const matches = searchAutocomplete(commands, "h");
			const choices = toDiscordChoices(matches);

			// Should have multiple matches
			expect(choices.length).toBeGreaterThan(0);
			
			// First should be "help" (exact match with alias "h")
			expect(choices[0].name).toBe("help");
			
			// All should have name and value
			choices.forEach(choice => {
				expect(choice).toHaveProperty("name");
				expect(choice).toHaveProperty("value");
			});
		});
	});
});
