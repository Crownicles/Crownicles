import { StringConstants } from "../constants/StringConstants";
import { ConstantRange } from "../constants/Constants";

/**
 * Remove discord formatting scrap from usernames
 * @param username
 */
export function escapeUsername(username: string): string {
	let fixedName = username.replace(/[*`_|]/gu, "");
	if (fixedName === "") {
		fixedName = ".";
	}
	return fixedName;
}

/**
 * Creates a bar of progression
 * @param value
 * @param maxValue
 */
export function progressBar(value: number, maxValue: number): string {
	let percentage = value / maxValue; // Calculate the percentage of the bar
	if (percentage < 0 || isNaN(percentage) || percentage === Infinity) {
		percentage = 0;
	}
	if (percentage > 1) {
		percentage = 1;
	}

	// Calculate the number of square characters to fill the progress side.
	const progress = Math.round(StringConstants.PROGRESS_BAR_SIZE * percentage);

	// Calculate the number of dash characters to fill the empty progress side.
	const emptyProgress = StringConstants.PROGRESS_BAR_SIZE - progress;

	// Repeat is creating a string with progress * characters in it
	const progressText = "▇".repeat(progress);

	// Repeat is creating a string with empty progress * characters in it
	const emptyProgressText = "—".repeat(emptyProgress);

	// Displaying the percentage of the bar
	const percentageText = `${Math.floor(percentage * 100)}%`;

	// Creating the bar
	return `\`\`\`[${progressText}${emptyProgressText}]${percentageText}\`\`\``;
}

/**
 * Check if a name is valid (is used to check guilds or pet names and guild descriptions)
 * @param name - the string to check
 * @param range - custom range for the name length
 */
export function checkNameString(name: string, range: ConstantRange): boolean {
	// Here are the characters that are allowed in a name or description
	const regexAllowed = /^[A-Za-z0-9 ÇçÜüÉéÂâÄäÀàÊêËëÈèÏïÎîÔôÖöÛû!,'.:()-]+$/u;

	/*
	 * Here are the scenarios where the name is not valid and checked by this regex :
	 * The name contains only numbers ^[0-9 ]+$ (only numbers and spaces)
	 * ( {2}) is used to check if there are 2 spaces in a row
	 * ([ÇçÜüÉéÂâÄäÀàÊêËëÈèÏïÎîÔôÖöÛû]{2}) is used to check if there are 2 special characters in a row
	 * ([!,'.:()-]{2}) is used to check if there are 2 punctuation characters in a row
	 */
	const regexSpecialCases = /^[0-9 ]+$|( {2})|([ÇçÜüÉéÂâÄäÀàÊêËëÈèÏïÎîÔôÖöÛû]{2})|([!,'.:()-]{2})/u;

	// We also check for the length of the name
	return regexAllowed.test(name) && !regexSpecialCases.test(name) && name.length >= range.MIN && name.length <= range.MAX;
}

/**
 * Convert a discord id to its corresponding mention
 * @param id
 */
export function discordIdToMention(id: string): string {
	return `<@${id}>`;
}

/**
 * Check if the given variable is a Keycloak id
 * @param variable
 */
export function isAnId(variable: string): boolean {
	return (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u).test(variable);
}

/**
 * Check if the given variable is a Discord Emoji
 * @param variable
 */
export function isAnEmoji(variable: string): boolean {
	return (/\p{Emoji}/u).test(variable);
}

/**
 * Get the mention
 * @param discordUserId
 */
export function getMention(discordUserId: string): string {
	return `<@${discordUserId}>`;
}

/**
 * Get a channel mention
 * @param discordChannelId
 */
export function getChannelMention(discordChannelId: string): string {
	return `<#${discordChannelId}>`;
}

/**
 * Converts a ratio value (e.g., 0.8 or 1.2) into a signed percentage difference.
 *
 * The calculation is based on the formula: `(1 - value) * 100`.
 * - If `value` is less than 1, the result is positive (indicating a percentage increase).
 * - If `value` is greater than 1, the result is negative (indicating a percentage decrease).
 * - If `value` is exactly 1, the result is 0 (indicating no change).
 *
 * Only returns integer values.
 *
 * @param value - The ratio value to convert.
 * @returns The signed percentage difference as a number.
 *
 * @example
 * toSignedPercent(0.8); // -20
 * toSignedPercent(1.2); // 20
 * toSignedPercent(1); // 0
 */
export function toSignedPercent(value: number): number {
	return Math.round(-((1 - value) * 100));
}
