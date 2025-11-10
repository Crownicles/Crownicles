/**
 * Autocomplete Utility for Discord Slash Commands
 *
 * This utility provides a scoring-based autocomplete system that ranks matches by relevance:
 * - Exact matches get highest priority (1000 points)
 * - Prefix matches get high priority (500+ points, shorter = better)
 * - Substring matches get medium priority (100+ points, shorter = better)
 *
 * Example usage:
 * ```typescript
 * const items: AutocompleteSearchItem[] = [
 *   { key: "HELP", displayName: "help", aliases: ["help", "h", "aide"] },
 *   { key: "PROFILE", displayName: "profile", aliases: ["profile", "p"] }
 * ];
 *
 * const matches = searchAutocomplete(items, userInput);
 * const choices = toDiscordChoices(matches);
 * await interaction.respond(choices);
 * ```
 */

/**
 * Constants for autocomplete scoring algorithm
 */
export const AUTOCOMPLETE_SCORE = {
	EXACT_MATCH: 1000,
	STARTS_WITH_BASE: 500,
	STARTS_WITH_LENGTH_BONUS: 100,
	CONTAINS_BASE: 100,
	CONTAINS_LENGTH_BONUS: 10
} as const;

/**
 * Maximum number of autocomplete choices Discord allows
 */
export const MAX_AUTOCOMPLETE_CHOICES = 25;

/**
 * Result of an autocomplete match with score
 */
export interface AutocompleteMatch<T = string> {

	/**
	 * The display name shown in the autocomplete dropdown
	 */
	name: string;

	/**
	 * The value that will be sent when the user selects this option
	 */
	value: string;

	/**
	 * The score of this match (higher is better)
	 */
	score: number;

	/**
	 * The original key/identifier for this match
	 */
	key: T;
}

/**
 * Options for a searchable item
 */
export interface AutocompleteSearchItem<T = string> {

	/**
	 * Unique key/identifier for this item
	 */
	key: T;

	/**
	 * Display name to show in autocomplete
	 */
	displayName: string;

	/**
	 * Array of aliases/keywords that can match this item
	 */
	aliases: string[];
}

/**
 * Score a single alias against the focused value
 * @param alias The alias to score
 * @param focusedValue The user's input (will be lowercased for comparison)
 * @returns The score (0 if no match)
 */
export function scoreAlias(alias: string, focusedValue: string): number {
	const aliasLower = alias.toLowerCase();
	const focusedLower = focusedValue.toLowerCase();

	// Exact match: highest priority
	if (aliasLower === focusedLower) {
		return AUTOCOMPLETE_SCORE.EXACT_MATCH;
	}

	// Starts with the input: high priority (shorter matches score higher)
	if (aliasLower.startsWith(focusedLower)) {
		return AUTOCOMPLETE_SCORE.STARTS_WITH_BASE + (AUTOCOMPLETE_SCORE.STARTS_WITH_LENGTH_BONUS / alias.length);
	}

	// Contains the input: medium priority (shorter matches score higher)
	if (aliasLower.includes(focusedLower)) {
		return AUTOCOMPLETE_SCORE.CONTAINS_BASE + (AUTOCOMPLETE_SCORE.CONTAINS_LENGTH_BONUS / alias.length);
	}

	// No match
	return 0;
}

/**
 * Find the best matching alias for an item
 * @param item The item to search
 * @param focusedValue The user's input
 * @returns The best match with score and alias, or null if no match
 */
export function findBestMatch<T>(
	item: AutocompleteSearchItem<T>,
	focusedValue: string
): {
	score: number; alias: string;
} | null {
	let bestScore = 0;
	let bestAlias = item.aliases[0] || "";

	for (const alias of item.aliases) {
		const score = scoreAlias(alias, focusedValue);

		if (score > bestScore) {
			bestScore = score;
			bestAlias = alias;
		}
	}

	return bestScore > 0
		? {
			score: bestScore, alias: bestAlias
		}
		: null;
}

/**
 * Search through items and return sorted autocomplete matches
 * @param items Array of searchable items
 * @param focusedValue The user's input
 * @param maxResults Maximum number of results to return (defaults to Discord's limit)
 * @returns Sorted array of matches (best matches first)
 */
export function searchAutocomplete<T = string>(
	items: AutocompleteSearchItem<T>[],
	focusedValue: string,
	maxResults: number = MAX_AUTOCOMPLETE_CHOICES
): AutocompleteMatch<T>[] {
	const matches: AutocompleteMatch<T>[] = [];

	for (const item of items) {
		const match = findBestMatch(item, focusedValue);

		if (match) {
			matches.push({
				name: item.displayName,
				value: match.alias,
				score: match.score,
				key: item.key
			});
		}
	}

	// Sort by score (descending) and take top N results
	return matches
		.sort((a, b) => b.score - a.score)
		.slice(0, maxResults);
}

/**
 * Convert autocomplete matches to Discord's expected format
 * @param matches Array of matches from searchAutocomplete
 * @returns Array in Discord's autocomplete format
 */
export function toDiscordChoices(matches: AutocompleteMatch[]): Array<{
	name: string; value: string;
}> {
	return matches.map(({
		name, value
	}) => ({
		name, value
	}));
}
